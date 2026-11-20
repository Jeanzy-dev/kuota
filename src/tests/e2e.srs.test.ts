import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import { db } from '../server/db';
import { runFinancialProjectionEngine } from '../shared/financialEngine';

describe('Validación Matemática y Flujo E2E del SRS (Secciones 3 y 7.4)', () => {
  beforeAll(async () => {
    process.env.PGLITE_DATA_DIR = 'memory://';
    await db.init();
  });

  it('Verifica las reglas matemáticas exactas de la Sección 3.1 y 3.2 (IND, DTM, ADR, PGL, ARA, SRM, Δt)', () => {
    const result = runFinancialProjectionEngine({
      cycleType: 'MONTHLY',
      declaredCycleIncome: 3000000,
      expenses: [
        { name: 'Arriendo', amount: 500000, frequency: 'MONTHLY', is_recurring: true, is_paid: true },
        { name: 'Servicios públicos', amount: 200000, frequency: 'MONTHLY', is_recurring: true, is_paid: false },
        { name: 'Corte de cabello / motilada', amount: 15000, frequency: 'BIWEEKLY', is_recurring: true, is_paid: true },
      ],
      goals: [
        {
          id: 'goal-1',
          product_name: 'Portátil para desarrollo',
          target_amount: 3600000,
          saved_amount: 0,
          duration_value: 3,
          duration_unit: 'MONTHS',
          priority: 1,
          allocation_pct: 100,
          is_primary: true,
          start_date: new Date('2026-01-01'),
          target_date: new Date('2026-04-01'),
        },
      ],
      checklists: [
        {
          id: 'chk-1',
          goal_id: 'goal-1',
          cycle_id: 'cyc-1',
          period_label: 'Semana 1',
          period_days: 7,
          budget_limit: 247113.16,
          actual_spent: 447113.16, // Gastó $200.000 de más sobre su límite libre
          deviation: -200000,
          status: 'OVER_BUDGET',
          days_impact: -5,
        },
      ],
      weekendPercentage: 55,
    });

    // Motilada quincenal de $15.000 normalizada a ciclo mensual (30 días) = $30.000
    // Total Gastos Obligatorios del Ciclo = 500.000 + 200.000 + 30.000 = 730.000
    expect(result.totalCycleMandatoryExpenses).toBe(730000);

    // 1. IND = 3.000.000 - 730.000 = 2.270.000
    expect(result.netAvailableIncome).toBe(2270000);

    // 2. DTM = 3 meses * 30 = 90 días
    const goal = result.primaryGoalProjection!;
    expect(goal.totalGoalDays).toBe(90);

    // 3. ADR = 3.600.000 / 90 = 40.000 / día
    expect(goal.dailyRequiredSavings).toBe(40000);

    // 4. Ahorro Requerido por Ciclo = 40.000 * 30 = 1.200.000
    expect(goal.cycleRequiredSavings).toBe(1200000);

    // 5. PGL = 2.270.000 - 1.200.000 = 1.070.000
    expect(result.freeSpendingBudgetCycle).toBe(1070000);

    // Tope semanal = 1.070.000 / 4.33 = 247113.16
    expect(result.limits.weeklyLimit).toBeCloseTo(247113.16, 1);

    // 6. Checklist con exceso de gasto de $200.000 -> ADR es $40.000/día -> Δt = -5 días de atraso
    expect(goal.variationInDays).toBe(-5);
    expect(goal.temporalBreakdown.direction).toBe('DELAYED');
    expect(goal.temporalBreakdown.absDays).toBe(5);
  });

  it('Cumple el flujo E2E completo de la Sección 7.4: registro → modo informal → gastos obligatorios → creación de meta → exceso de gasto en checklist → verificación de días de atraso en dashboard', async () => {
    const agent = request.agent(app);
    const uniqueEmail = `e2e.informal.${Date.now()}@kuota.app`;

    // 1. Registro de usuario
    const regRes = await agent.post('/api/auth/register').send({
      email: uniqueEmail,
      password: 'PasswordE2E123!',
      name: 'Usuario E2E Informal',
      currency: 'COP',
    });
    expect(regRes.status).toBe(201);
    const token = regRes.body.token;
    expect(token).toBeTruthy();

    // 2. Configuración Modo Informal con presupuesto de ciclo de $3.200.000 COP
    const profRes = await agent
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        income_mode: 'INFORMAL',
        cycle_type: 'MONTHLY',
        declared_cycle_income: 3200000,
      });
    expect(profRes.status).toBe(200);
    expect(profRes.body.user.income_mode).toBe('INFORMAL');
    expect(profRes.body.activeCycle.declared_income).toBe(3200000);

    // 3. Carga de gastos obligatorios (Arriendo $500.000, Servicios $200.000)
    await agent
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Arriendo',
        amount: 500000,
        frequency: 'MONTHLY',
        is_paid: true,
      });

    const expRes = await agent
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Servicios públicos',
        amount: 200000,
        frequency: 'MONTHLY',
        is_paid: false,
      });
    expect(expRes.status).toBe(201);
    expect(expRes.body.analysis.totalCycleMandatoryExpenses).toBe(700000);
    expect(expRes.body.analysis.netAvailableIncome).toBe(2500000);

    // 4. Creación de meta ("Moto" - $4.500.000 en 3 meses = 90 días -> ADR = $50.000/día)
    const goalRes = await agent
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        product_name: 'Moto para trabajo',
        target_amount: 4500000,
        duration_value: 3,
        duration_unit: 'MONTHS',
        is_primary: true,
      });
    expect(goalRes.status).toBe(201);
    const createdGoal = goalRes.body.analysis.primaryGoalProjection;
    expect(createdGoal.dailyRequiredSavings).toBe(50000);

    // 5. Marcación de exceso de gasto en checklist ("Gasté de más": $250.000 de exceso -> 250.000 / 50.000 = -5 días de atraso)
    const chkRes = await agent
      .post('/api/checklists')
      .set('Authorization', `Bearer ${token}`)
      .send({
        goal_id: createdGoal.goalId,
        period_label: 'Semana 1 - Control Semanal',
        period_type: 'WEEKLY',
        status: 'OVER_BUDGET',
        extra_or_overspent_amount: 250000,
      });
    expect(chkRes.status).toBe(201);

    // 6. Verificación del cálculo de días de atraso en el estado del Dashboard
    const updatedProj = chkRes.body.analysis.primaryGoalProjection;
    expect(updatedProj.variationInDays).toBe(-5);
    expect(updatedProj.temporalBreakdown.direction).toBe('DELAYED');
    expect(updatedProj.temporalBreakdown.absDays).toBe(5);
    expect(updatedProj.temporalBreakdown.badgeText).toContain('-5 días de atraso');
  });
});
