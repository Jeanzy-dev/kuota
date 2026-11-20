import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from './db';
import {
  AuthenticatedRequest,
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signAuthToken,
} from './auth';
import {
  calculateChecklistItemImpact,
  calculateCycleIncomeFromFixedSalary,
  calculateTotalGoalDays,
  runFinancialProjectionEngine,
  ChecklistStatus,
  CycleType,
  DurationUnit,
  ExpenseFrequency,
  IncomeMode,
  SalaryFrequency,
} from '../shared/financialEngine';

export const apiRouter = Router();

// Esquemas de validación Zod estrictos (SRS Sección 4)
const registerSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(1).optional().default('Usuario'),
  currency: z.enum(['COP', 'USD', 'EUR', 'MXN']).optional().default('COP'),
  income_mode: z.enum(['FIXED', 'INFORMAL']).optional().default('FIXED'),
  cycle_type: z.enum(['BIWEEKLY', 'MONTHLY']).optional().default('MONTHLY'),
});

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  currency: z.enum(['COP', 'USD', 'EUR', 'MXN']).optional(),
  income_mode: z.enum(['FIXED', 'INFORMAL']).optional(),
  cycle_type: z.enum(['BIWEEKLY', 'MONTHLY']).optional(),
  fixed_salary_amount: z.union([z.number(), z.string()]).optional(),
  salary_frequency: z.enum(['BIWEEKLY', 'MONTHLY', 'ANNUAL']).optional(),
  weekend_percentage: z.number().min(20).max(80).optional(),
  onboarding_done: z.boolean().optional(),
  declared_cycle_income: z.union([z.number(), z.string()]).optional(),
});

const cycleCreateSchema = z.object({
  period_name: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  declared_income: z.union([z.number(), z.string()]),
  copy_recurring_expenses: z.boolean().optional().default(true),
});

const expenseCreateSchema = z.object({
  name: z.string().min(1, 'El nombre del gasto es obligatorio'),
  category: z.string().optional().default('Compromiso Fijo'),
  amount: z.union([z.number(), z.string()]),
  frequency: z.enum(['BIWEEKLY', 'MONTHLY', 'ONCE']).optional().default('MONTHLY'),
  is_recurring: z.boolean().optional().default(true),
  is_paid: z.boolean().optional().default(false),
  cycle_id: z.string().nullable().optional(),
});

const goalCreateSchema = z.object({
  product_name: z.string().min(1, 'El nombre de la meta/producto es obligatorio'),
  target_amount: z.union([z.number(), z.string()]),
  saved_amount: z.union([z.number(), z.string()]).optional().default(0),
  duration_value: z.number().int().min(1),
  duration_unit: z.enum(['DAYS', 'WEEKS', 'MONTHS']),
  priority: z.number().int().min(1).optional().default(1),
  allocation_pct: z.union([z.number(), z.string()]).optional().default(100),
  is_primary: z.boolean().optional().default(true),
  start_date: z.string().optional(),
});

const checklistCreateSchema = z.object({
  goal_id: z.string().min(1),
  cycle_id: z.string().optional(),
  period_label: z.string().min(1),
  period_type: z.enum(['WEEKLY', 'WEEKEND', 'CYCLE_CLOSE']).optional().default('WEEKLY'),
  period_days: z.number().int().min(1).optional(),
  status: z.enum(['ON_TRACK', 'OVER_BUDGET', 'SAVED_EXTRA']),
  budget_limit: z.union([z.number(), z.string()]).optional(),
  actual_spent: z.union([z.number(), z.string()]).optional(),
  extra_or_overspent_amount: z.union([z.number(), z.string()]).optional(),
  notes: z.string().optional(),
});

/**
 * Helper que obtiene o autogenera el ciclo activo del usuario.
 * En Modo Salario (FIXED), si no tiene ciclo activo, lo autogenera con el salario prorrateado al ciclo (SRS Sección 5).
 */
async function ensureActiveCycleForUser(user: any): Promise<any> {
  const existing = await db.query(
    `SELECT * FROM income_cycles WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY start_date DESC LIMIT 1`,
    [user.id]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const now = new Date();
  const cycleDays = user.cycle_type === 'BIWEEKLY' ? 15 : 30;
  const endDate = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);

  let declaredIncome = '0.00';
  if (user.income_mode === 'FIXED') {
    const calculated = calculateCycleIncomeFromFixedSalary(
      user.fixed_salary_amount || 0,
      (user.salary_frequency as SalaryFrequency) || 'MONTHLY',
      (user.cycle_type as CycleType) || 'MONTHLY'
    );
    declaredIncome = calculated.toFixed(2);
  }

  const periodName =
    user.cycle_type === 'BIWEEKLY'
      ? `Quincena ${now.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}`
      : `Ciclo Mensual ${now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}`;

  const cycleId = crypto.randomUUID();
  const inserted = await db.query(
    `INSERT INTO income_cycles (id, user_id, period_name, start_date, end_date, declared_income, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
     RETURNING *`,
    [cycleId, user.id, periodName, now.toISOString(), endDate.toISOString(), declaredIncome]
  );

  return inserted.rows[0];
}

/**
 * Construye el estado financiero completo del usuario (Perfil + Ciclo Activo + Gastos + Metas + Checklists + Proyección)
 */
async function buildUserWorkspaceState(userId: string) {
  const userRes = await db.query(
    `SELECT id, email, name, currency, income_mode, cycle_type, fixed_salary_amount,
            salary_frequency, weekend_percentage, onboarding_done, created_at
     FROM users WHERE id = $1`,
    [userId]
  );
  if (userRes.rows.length === 0) {
    throw new Error('Usuario no encontrado');
  }
  const user = userRes.rows[0];

  const activeCycle = await ensureActiveCycleForUser(user);

  const allCyclesRes = await db.query(
    `SELECT * FROM income_cycles WHERE user_id = $1 ORDER BY start_date DESC`,
    [userId]
  );

  // Obtenemos gastos obligatorios del usuario (los recurrentes o asociados al ciclo activo)
  const expensesRes = await db.query(
    `SELECT * FROM mandatory_expenses 
     WHERE user_id = $1 AND (cycle_id = $2 OR cycle_id IS NULL OR is_recurring = true)
     ORDER BY created_at ASC`,
    [userId, activeCycle.id]
  );

  const goalsRes = await db.query(
    `SELECT * FROM savings_goals WHERE user_id = $1 ORDER BY is_primary DESC, priority ASC, created_at ASC`,
    [userId]
  );

  const checklistsRes = await db.query(
    `SELECT tc.* FROM tracking_checklists tc
     INNER JOIN savings_goals sg ON sg.id = tc.goal_id
     WHERE sg.user_id = $1
     ORDER BY tc.recorded_at DESC, tc.created_at DESC`,
    [userId]
  );

  // Determinamos el ingreso efectivo del ciclo actual
  let declaredCycleIncome = Number(activeCycle.declared_income || 0);
  if (user.income_mode === 'FIXED' && Number(user.fixed_salary_amount || 0) > 0) {
    const projected = calculateCycleIncomeFromFixedSalary(
      user.fixed_salary_amount,
      user.salary_frequency as SalaryFrequency,
      user.cycle_type as CycleType
    );
    declaredCycleIncome = projected.toNumber();
  }

  const analysis = runFinancialProjectionEngine({
    cycleType: user.cycle_type as CycleType,
    declaredCycleIncome,
    expenses: expensesRes.rows.map((e) => ({
      id: e.id,
      name: e.name,
      amount: e.amount,
      frequency: e.frequency as ExpenseFrequency,
      is_recurring: e.is_recurring,
      is_paid: e.is_paid,
    })),
    goals: goalsRes.rows.map((g) => ({
      id: g.id,
      product_name: g.product_name,
      target_amount: g.target_amount,
      saved_amount: g.saved_amount,
      duration_value: Number(g.duration_value),
      duration_unit: g.duration_unit as DurationUnit,
      priority: Number(g.priority),
      allocation_pct: g.allocation_pct,
      is_primary: g.is_primary,
      start_date: g.start_date,
      target_date: g.target_date,
    })),
    checklists: checklistsRes.rows.map((c) => ({
      id: c.id,
      goal_id: c.goal_id,
      cycle_id: c.cycle_id,
      period_label: c.period_label,
      period_type: c.period_type,
      period_days: Number(c.period_days || 7),
      budget_limit: c.budget_limit,
      actual_spent: c.actual_spent,
      deviation: c.deviation,
      status: c.status as ChecklistStatus,
      days_impact: c.days_impact,
      recorded_at: c.recorded_at,
    })),
    weekendPercentage: Number(user.weekend_percentage || 55),
  });

  return {
    user: {
      ...user,
      fixed_salary_amount: Number(user.fixed_salary_amount || 0),
      weekend_percentage: Number(user.weekend_percentage || 55),
    },
    activeCycle: {
      ...activeCycle,
      declared_income: declaredCycleIncome,
    },
    cyclesHistory: allCyclesRes.rows.map((c) => ({
      ...c,
      declared_income: Number(c.declared_income || 0),
    })),
    mandatoryExpenses: expensesRes.rows.map((e) => ({
      ...e,
      amount: Number(e.amount || 0),
    })),
    savingsGoals: goalsRes.rows.map((g) => ({
      ...g,
      target_amount: Number(g.target_amount || 0),
      saved_amount: Number(g.saved_amount || 0),
      allocation_pct: Number(g.allocation_pct || 100),
    })),
    trackingChecklists: checklistsRes.rows.map((c) => ({
      ...c,
      budget_limit: Number(c.budget_limit || 0),
      actual_spent: Number(c.actual_spent || 0),
      deviation: Number(c.deviation || 0),
      days_impact: Number(c.days_impact || 0),
    })),
    analysis,
  };
}

// ==========================================
// 1. AUTENTICACIÓN Y GESTIÓN DE PERFIL (2.1)
// ==========================================

apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const emailLower = parsed.email.toLowerCase().trim();

    const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [emailLower]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con este correo.' });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const userId = crypto.randomUUID();

    await db.query(
      `INSERT INTO users (id, email, name, password_hash, currency, income_mode, cycle_type, onboarding_done)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
      [
        userId,
        emailLower,
        parsed.name,
        passwordHash,
        parsed.currency,
        parsed.income_mode,
        parsed.cycle_type,
      ]
    );

    const token = signAuthToken({ userId, email: emailLower });
    setAuthCookie(res, token);

    const state = await buildUserWorkspaceState(userId);
    return res.status(201).json({ token, ...state });
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({ error: err.issues[0].message, details: err.issues });
    }
    return res.status(500).json({ error: err.message || 'Error al registrar usuario' });
  }
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const emailLower = parsed.email.toLowerCase().trim();

    const userRes = await db.query(`SELECT * FROM users WHERE email = $1`, [emailLower]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica correo y contraseña.' });
    }

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(parsed.password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica correo y contraseña.' });
    }

    const token = signAuthToken({ userId: user.id, email: user.email });
    setAuthCookie(res, token);

    const state = await buildUserWorkspaceState(user.id);
    return res.json({ token, ...state });
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({ error: err.issues[0].message });
    }
    return res.status(500).json({ error: err.message || 'Error al iniciar sesión' });
  }
});

apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await buildUserWorkspaceState(req.user!.userId);
    return res.json(state);
  } catch (err: any) {
    return res.status(401).json({ error: err.message });
  }
});

apiRouter.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = profileUpdateSchema.parse(req.body);
    const userId = req.user!.userId;

    const currentRes = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const curr = currentRes.rows[0];

    const newName = parsed.name ?? curr.name;
    const newCurrency = parsed.currency ?? curr.currency;
    const newIncomeMode: IncomeMode = (parsed.income_mode ?? curr.income_mode) as IncomeMode;
    const newCycleType: CycleType = (parsed.cycle_type ?? curr.cycle_type) as CycleType;
    const newFixedSalary =
      parsed.fixed_salary_amount !== undefined
        ? Number(parsed.fixed_salary_amount)
        : Number(curr.fixed_salary_amount || 0);
    const newSalaryFreq: SalaryFrequency = (parsed.salary_frequency ??
      curr.salary_frequency) as SalaryFrequency;
    const newWeekendPct =
      parsed.weekend_percentage !== undefined
        ? Number(parsed.weekend_percentage)
        : Number(curr.weekend_percentage || 55);
    const newOnboardingDone =
      parsed.onboarding_done !== undefined ? parsed.onboarding_done : curr.onboarding_done;

    await db.query(
      `UPDATE users
       SET name = $1, currency = $2, income_mode = $3, cycle_type = $4,
           fixed_salary_amount = $5, salary_frequency = $6, weekend_percentage = $7,
           onboarding_done = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9`,
      [
        newName,
        newCurrency,
        newIncomeMode,
        newCycleType,
        newFixedSalary.toFixed(2),
        newSalaryFreq,
        newWeekendPct,
        newOnboardingDone,
        userId,
      ]
    );

    // Actualizamos el ciclo activo si se envió un ingreso declarado o si está en Modo Salario Fijo
    const updatedUserRes = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    const activeCycle = await ensureActiveCycleForUser(updatedUserRes.rows[0]);

    if (newIncomeMode === 'FIXED') {
      const cycleIncome = calculateCycleIncomeFromFixedSalary(
        newFixedSalary,
        newSalaryFreq,
        newCycleType
      );
      await db.query(
        `UPDATE income_cycles SET declared_income = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [cycleIncome.toFixed(2), activeCycle.id]
      );
    } else if (parsed.declared_cycle_income !== undefined) {
      await db.query(
        `UPDATE income_cycles SET declared_income = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [Number(parsed.declared_cycle_income).toFixed(2), activeCycle.id]
      );
    }

    const state = await buildUserWorkspaceState(userId);
    return res.json(state);
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({ error: err.issues[0].message });
    }
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. MOTOR DE INGRESOS Y CICLOS (2.2)
// ==========================================

apiRouter.post('/cycles', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = cycleCreateSchema.parse(req.body);
    const userId = req.user!.userId;

    const userRes = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    const user = userRes.rows[0];

    // Cerramos ciclos anteriores que estuvieran activos
    await db.query(
      `UPDATE income_cycles SET status = 'CLOSED', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'ACTIVE'`,
      [userId]
    );

    const startDate = parsed.start_date ? new Date(parsed.start_date) : new Date();
    const cycleDays = user.cycle_type === 'BIWEEKLY' ? 15 : 30;
    const endDate = parsed.end_date
      ? new Date(parsed.end_date)
      : new Date(startDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);

    const periodName =
      parsed.period_name ||
      (user.cycle_type === 'BIWEEKLY'
        ? `Quincena (${startDate.toLocaleDateString('es-CO')})`
        : `Período Mensual (${startDate.toLocaleDateString('es-CO')})`);

    const newCycleId = crypto.randomUUID();
    await db.query(
      `INSERT INTO income_cycles (id, user_id, period_name, start_date, end_date, declared_income, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')`,
      [
        newCycleId,
        userId,
        periodName,
        startDate.toISOString(),
        endDate.toISOString(),
        Number(parsed.declared_income).toFixed(2),
      ]
    );

    // Si reiniciamos un nuevo período, podemos marcar los gastos recurrentes como Pendientes para el nuevo ciclo
    if (parsed.copy_recurring_expenses) {
      await db.query(
        `UPDATE mandatory_expenses SET is_paid = false, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND is_recurring = true`,
        [userId]
      );
    }

    const state = await buildUserWorkspaceState(userId);
    return res.status(201).json(state);
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({ error: err.issues[0].message });
    }
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/cycles/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const cycleId = req.params.id;
    const { declared_income, period_name, status } = req.body;

    const existing = await db.query(
      `SELECT * FROM income_cycles WHERE id = $1 AND user_id = $2`,
      [cycleId, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Ciclo presupuestario no encontrado' });
    }

    const curr = existing.rows[0];
    const updatedIncome =
      declared_income !== undefined ? Number(declared_income).toFixed(2) : curr.declared_income;
    const updatedName = period_name !== undefined ? period_name : curr.period_name;
    const updatedStatus = status !== undefined ? status : curr.status;

    await db.query(
      `UPDATE income_cycles 
       SET declared_income = $1, period_name = $2, status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5`,
      [updatedIncome, updatedName, updatedStatus, cycleId, userId]
    );

    const state = await buildUserWorkspaceState(userId);
    return res.json(state);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. GESTIÓN DE GASTOS OBLIGATORIOS (2.3)
// ==========================================

apiRouter.post('/expenses', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = expenseCreateSchema.parse(req.body);
    const userId = req.user!.userId;
    const userRes = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    const activeCycle = await ensureActiveCycleForUser(userRes.rows[0]);

    const expenseId = crypto.randomUUID();
    await db.query(
      `INSERT INTO mandatory_expenses (id, user_id, cycle_id, name, category, amount, frequency, is_recurring, is_paid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        expenseId,
        userId,
        parsed.cycle_id ?? activeCycle.id,
        parsed.name.trim(),
        parsed.category,
        Number(parsed.amount).toFixed(2),
        parsed.frequency,
        parsed.is_recurring,
        parsed.is_paid,
      ]
    );

    const state = await buildUserWorkspaceState(userId);
    return res.status(201).json(state);
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({ error: err.issues[0].message });
    }
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/expenses/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const expenseId = req.params.id;

    const existing = await db.query(
      `SELECT * FROM mandatory_expenses WHERE id = $1 AND user_id = $2`,
      [expenseId, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto obligatorio no encontrado' });
    }
    const curr = existing.rows[0];

    const name = req.body.name !== undefined ? String(req.body.name).trim() : curr.name;
    const category = req.body.category !== undefined ? req.body.category : curr.category;
    const amount =
      req.body.amount !== undefined ? Number(req.body.amount).toFixed(2) : curr.amount;
    const frequency = req.body.frequency !== undefined ? req.body.frequency : curr.frequency;
    const isRecurring =
      req.body.is_recurring !== undefined ? Boolean(req.body.is_recurring) : curr.is_recurring;
    const isPaid = req.body.is_paid !== undefined ? Boolean(req.body.is_paid) : curr.is_paid;

    await db.query(
      `UPDATE mandatory_expenses
       SET name = $1, category = $2, amount = $3, frequency = $4, is_recurring = $5, is_paid = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8`,
      [name, category, amount, frequency, isRecurring, isPaid, expenseId, userId]
    );

    const state = await buildUserWorkspaceState(userId);
    return res.json(state);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/expenses/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const expenseId = req.params.id;

    await db.query(`DELETE FROM mandatory_expenses WHERE id = $1 AND user_id = $2`, [
      expenseId,
      userId,
    ]);

    const state = await buildUserWorkspaceState(userId);
    return res.json(state);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. CREACIÓN Y GESTIÓN DE METAS DE COMPRA (2.4)
// ==========================================

apiRouter.post('/goals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = goalCreateSchema.parse(req.body);
    const userId = req.user!.userId;

    const startDate = parsed.start_date ? new Date(parsed.start_date) : new Date();
    const totalDays = calculateTotalGoalDays(
      parsed.duration_value,
      parsed.duration_unit as DurationUnit
    ).toNumber();
    const targetDate = new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000);

    if (parsed.is_primary) {
      await db.query(`UPDATE savings_goals SET is_primary = false WHERE user_id = $1`, [userId]);
    }

    const goalId = crypto.randomUUID();
    await db.query(
      `INSERT INTO savings_goals (
        id, user_id, product_name, target_amount, saved_amount,
        duration_value, duration_unit, priority, allocation_pct,
        is_primary, status, start_date, target_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', $11, $12)`,
      [
        goalId,
        userId,
        parsed.product_name.trim(),
        Number(parsed.target_amount).toFixed(2),
        Number(parsed.saved_amount || 0).toFixed(2),
        parsed.duration_value,
        parsed.duration_unit,
        parsed.priority,
        Number(parsed.allocation_pct || 100).toFixed(2),
        parsed.is_primary,
        startDate.toISOString(),
        targetDate.toISOString(),
      ]
    );

    const state = await buildUserWorkspaceState(userId);
    return res.status(201).json(state);
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({ error: err.issues[0].message });
    }
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/goals/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;

    const existing = await db.query(
      `SELECT * FROM savings_goals WHERE id = $1 AND user_id = $2`,
      [goalId, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Meta de ahorro no encontrada' });
    }
    const curr = existing.rows[0];

    const productName =
      req.body.product_name !== undefined ? String(req.body.product_name).trim() : curr.product_name;
    const targetAmount =
      req.body.target_amount !== undefined
        ? Number(req.body.target_amount).toFixed(2)
        : curr.target_amount;
    const savedAmount =
      req.body.saved_amount !== undefined
        ? Number(req.body.saved_amount).toFixed(2)
        : curr.saved_amount;
    const durationValue =
      req.body.duration_value !== undefined
        ? Number(req.body.duration_value)
        : Number(curr.duration_value);
    const durationUnit = (req.body.duration_unit ?? curr.duration_unit) as DurationUnit;
    const priority =
      req.body.priority !== undefined ? Number(req.body.priority) : Number(curr.priority);
    const allocationPct =
      req.body.allocation_pct !== undefined
        ? Number(req.body.allocation_pct).toFixed(2)
        : curr.allocation_pct;
    const isPrimary =
      req.body.is_primary !== undefined ? Boolean(req.body.is_primary) : curr.is_primary;

    if (isPrimary) {
      await db.query(`UPDATE savings_goals SET is_primary = false WHERE user_id = $1`, [userId]);
    }

    const startDate = new Date(curr.start_date);
    const totalDays = calculateTotalGoalDays(durationValue, durationUnit).toNumber();
    const targetDate = new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000);

    await db.query(
      `UPDATE savings_goals
       SET product_name = $1, target_amount = $2, saved_amount = $3,
           duration_value = $4, duration_unit = $5, priority = $6,
           allocation_pct = $7, is_primary = $8, target_date = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND user_id = $11`,
      [
        productName,
        targetAmount,
        savedAmount,
        durationValue,
        durationUnit,
        priority,
        allocationPct,
        isPrimary,
        targetDate.toISOString(),
        goalId,
        userId,
      ]
    );

    const state = await buildUserWorkspaceState(userId);
    return res.json(state);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/goals/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;

    await db.query(`DELETE FROM savings_goals WHERE id = $1 AND user_id = $2`, [goalId, userId]);

    const state = await buildUserWorkspaceState(userId);
    return res.json(state);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. CHECKLIST DE SEGUIMIENTO Y DESVIACIÓN TEMPORAL (3.2)
// ==========================================

apiRouter.post('/checklists', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = checklistCreateSchema.parse(req.body);
    const userId = req.user!.userId;

    const currentState = await buildUserWorkspaceState(userId);
    const goalProj =
      currentState.analysis.allGoalsProjections.find((g) => g.goalId === parsed.goal_id) ||
      currentState.analysis.primaryGoalProjection;

    if (!goalProj) {
      return res.status(404).json({ error: 'Meta asociada no encontrada' });
    }

    const cycleId = parsed.cycle_id || currentState.activeCycle.id;

    // Determinamos el límite de presupuesto por defecto según el tipo de período (Semanal, Fin de Semana o Cierre de Ciclo)
    let defaultLimit = currentState.analysis.limits.weeklyLimit;
    let defaultPeriodDays = 7;
    if (parsed.period_type === 'WEEKEND') {
      defaultLimit = currentState.analysis.limits.weekendLimit;
      defaultPeriodDays = 2;
    } else if (parsed.period_type === 'CYCLE_CLOSE') {
      defaultLimit = currentState.analysis.freeSpendingBudgetCycle;
      defaultPeriodDays = currentState.analysis.cycleDays;
    }

    const budgetLimitToUse =
      parsed.budget_limit !== undefined ? Number(parsed.budget_limit) : defaultLimit;
    const periodDaysToUse = parsed.period_days ?? defaultPeriodDays;

    const impact = calculateChecklistItemImpact({
      status: parsed.status,
      budgetLimit: budgetLimitToUse,
      actualSpent: parsed.actual_spent,
      extraAmountOrOverspent: parsed.extra_or_overspent_amount,
      dailyRequiredSavings: goalProj.dailyRequiredSavings,
    });

    const checklistId = crypto.randomUUID();
    await db.query(
      `INSERT INTO tracking_checklists (
        id, goal_id, cycle_id, period_label, period_type, period_days,
        budget_limit, actual_spent, deviation, status, days_impact, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        checklistId,
        goalProj.goalId,
        cycleId,
        parsed.period_label.trim(),
        parsed.period_type,
        periodDaysToUse,
        impact.budgetLimit.toFixed(2),
        impact.actualSpent.toFixed(2),
        impact.deviation.toFixed(2),
        parsed.status,
        impact.daysImpact.toFixed(2),
        parsed.notes || null,
      ]
    );

    const updatedState = await buildUserWorkspaceState(userId);
    return res.status(201).json(updatedState);
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({ error: err.issues[0].message });
    }
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/checklists/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const checklistId = req.params.id;

    await db.query(
      `DELETE FROM tracking_checklists
       WHERE id = $1 AND goal_id IN (SELECT id FROM savings_goals WHERE user_id = $2)`,
      [checklistId, userId]
    );

    const state = await buildUserWorkspaceState(userId);
    return res.json(state);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
