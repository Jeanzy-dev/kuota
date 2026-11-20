import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './db';
import { apiRouter } from './routes';

dotenv.config();

export const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === FRONTEND_URL ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Healthcheck endpoint para Render
app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    dbMode: db.getMode(),
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiRouter);

// Servir Frontend compilado (Vite SPA) cuando existe dist/client (Render Production)
const clientBuildPath = path.resolve(process.cwd(), 'dist/client');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

/**
 * Semilla inicial (Seed) de cuenta demostrativa lista para inspeccionar todas las vistas del SRS
 * sin interferir con cuentas nuevas creadas en el flujo E2E.
 */
export async function ensureDemoSeedData(): Promise<void> {
  const demoEmail = 'demo@kuota.app';
  const existing = await db.query(`SELECT id, name FROM users WHERE email = $1`, [demoEmail]);
  if (existing.rows.length > 0) {
    if (String(existing.rows[0].name).includes('SRS')) {
      await db.query(`UPDATE users SET name = 'Carlos Andrés' WHERE email = $1`, [demoEmail]);
    }
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash('Demo123456!', 10);

  await db.query(
    `INSERT INTO users (
      id, email, name, password_hash, currency, income_mode, cycle_type,
      fixed_salary_amount, salary_frequency, weekend_percentage, onboarding_done
    ) VALUES ($1, $2, $3, $4, 'COP', 'FIXED', 'MONTHLY', 3800000, 'MONTHLY', 55, true)`,
    [userId, demoEmail, 'Carlos Andrés', passwordHash]
  );

  const cycleId = crypto.randomUUID();
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO income_cycles (id, user_id, period_name, start_date, end_date, declared_income, status)
     VALUES ($1, $2, 'Ciclo Mensual Actual', $3, $4, 3800000, 'ACTIVE')`,
    [cycleId, userId, startDate.toISOString(), endDate.toISOString()]
  );

  // Gastos obligatorios de ejemplo citados textualmente en la Sección 2.3 del SRS
  const demoExpenses = [
    { name: 'Arriendo', category: 'Vivienda', amount: 500000, frequency: 'MONTHLY', is_paid: true },
    {
      name: 'Servicios públicos',
      category: 'Vivienda',
      amount: 220000,
      frequency: 'MONTHLY',
      is_paid: true,
    },
    {
      name: 'Alimentación básica',
      category: 'Alimentación',
      amount: 650000,
      frequency: 'MONTHLY',
      is_paid: false,
    },
    {
      name: 'Transporte',
      category: 'Movilidad',
      amount: 200000,
      frequency: 'MONTHLY',
      is_paid: false,
    },
    {
      name: 'Corte de cabello / motilada',
      category: 'Cuidado Personal',
      amount: 15000,
      frequency: 'BIWEEKLY',
      is_paid: true,
    },
  ];

  for (const exp of demoExpenses) {
    await db.query(
      `INSERT INTO mandatory_expenses (id, user_id, cycle_id, name, category, amount, frequency, is_recurring, is_paid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
      [
        crypto.randomUUID(),
        userId,
        cycleId,
        exp.name,
        exp.category,
        exp.amount.toFixed(2),
        exp.frequency,
        exp.is_paid,
      ]
    );
  }

  // Meta de compra citada en la Sección 2.4 del SRS: "Portátil para desarrollo"
  const goalId = crypto.randomUUID();
  const goalTargetDate = new Date(startDate.getTime() + 120 * 24 * 60 * 60 * 1000); // 4 meses (120 días)
  await db.query(
    `INSERT INTO savings_goals (
      id, user_id, product_name, target_amount, saved_amount,
      duration_value, duration_unit, priority, allocation_pct,
      is_primary, status, start_date, target_date
    ) VALUES ($1, $2, 'Portátil para desarrollo', 4800000, 0, 4, 'MONTHS', 1, 100, true, 'ACTIVE', $3, $4)`,
    [goalId, userId, startDate.toISOString(), goalTargetDate.toISOString()]
  );

  // Checklists de ejemplo para la cuenta demo (ADR = 4.800.000 / 120 = $40.000/día)
  const checklists = [
    {
      period_label: 'Semana 1 — Control Semanal',
      period_type: 'WEEKLY',
      period_days: 7,
      budget_limit: 230946.88,
      actual_spent: 230946.88,
      deviation: 0,
      status: 'ON_TRACK',
      days_impact: 0,
      notes: 'Cumplí exactamente el presupuesto semanal proyectado.',
    },
    {
      period_label: 'Fin de Semana 2 — Control Ocio',
      period_type: 'WEEKEND',
      period_days: 2,
      budget_limit: 127020.78,
      actual_spent: 47020.78,
      deviation: 80000,
      status: 'SAVED_EXTRA',
      days_impact: 2.0,
      notes: 'Ahorré $80.000 extra evitando salidas costosas (+2 días de adelanto).',
    },
  ];

  for (const item of checklists) {
    await db.query(
      `INSERT INTO tracking_checklists (
        id, goal_id, cycle_id, period_label, period_type, period_days,
        budget_limit, actual_spent, deviation, status, days_impact, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        crypto.randomUUID(),
        goalId,
        cycleId,
        item.period_label,
        item.period_type,
        item.period_days,
        item.budget_limit.toFixed(2),
        item.actual_spent.toFixed(2),
        item.deviation.toFixed(2),
        item.status,
        item.days_impact.toFixed(2),
        item.notes,
      ]
    );
  }
}

export async function startServer(port = Number(process.env.PORT || 3000)) {
  await db.init();
  await ensureDemoSeedData();

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`[Kuota SRS Server] Escuchando en http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  startServer().catch((err) => {
    console.error('Error fatal al iniciar servidor:', err);
    process.exit(1);
  });
}
