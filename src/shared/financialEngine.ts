import Decimal from 'decimal.js';

// Configuración de alta precisión financiera para evitar errores de punto flotante
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type IncomeMode = 'FIXED' | 'INFORMAL';
export type CycleType = 'BIWEEKLY' | 'MONTHLY';
export type SalaryFrequency = 'BIWEEKLY' | 'MONTHLY' | 'ANNUAL';
export type ExpenseFrequency = 'BIWEEKLY' | 'MONTHLY' | 'ONCE';
export type DurationUnit = 'DAYS' | 'WEEKS' | 'MONTHS';
export type ChecklistStatus = 'ON_TRACK' | 'OVER_BUDGET' | 'SAVED_EXTRA';

export interface MandatoryExpenseInput {
  id?: string;
  name: string;
  amount: number | string;
  frequency: ExpenseFrequency;
  is_recurring: boolean;
  is_paid: boolean;
}

export interface SavingsGoalInput {
  id: string;
  product_name: string;
  target_amount: number | string;
  saved_amount: number | string;
  duration_value: number;
  duration_unit: DurationUnit;
  priority: number;
  allocation_pct: number | string;
  is_primary: boolean;
  start_date: string | Date;
  target_date: string | Date;
}

export interface ChecklistItemInput {
  id: string;
  goal_id: string;
  cycle_id: string;
  period_label: string;
  period_type?: string;
  period_days?: number;
  budget_limit: number | string;
  actual_spent: number | string;
  deviation?: number | string;
  status: ChecklistStatus;
  days_impact: number | string;
  recorded_at?: string | Date;
}

export interface TemporalDeltaBreakdown {
  totalDays: number; // Δt exacto con decimales
  absDays: number;
  weeksEquivalent: number;
  monthsEquivalent: number;
  formattedMonths: number;
  formattedWeeks: number;
  formattedRemainingDays: number;
  direction: 'AHEAD' | 'DELAYED' | 'ON_TRACK';
  summaryText: string;
  badgeText: string;
}

export interface GoalProjectionResult {
  goalId: string;
  productName: string;
  targetAmount: number;
  allocationPct: number;
  totalGoalDays: number; // DTM = Días Totales de la Meta
  dailyRequiredSavings: number; // ADR = Precio de la Meta / DTM
  cycleRequiredSavings: number; // Ahorro Requerido por Ciclo = ADR * Días del Ciclo
  monthlyRequiredSavings: number; // ADR * 30
  scheduledSavingsElapsed: number; // Ahorro Programado Transcurrido
  extraSavingsTotal: number; // Ahorros Extra
  overspentTotal: number; // Excesos de Gasto
  accumulatedRealSavings: number; // ARA = Ahorro Programado Transcurrido + Ahorros Extra - Excesos de Gasto
  remainingBalance: number; // SRM = Precio de la Meta - ARA
  originalRemainingDays: number; // Días Restantes Originales
  estimatedRealRemainingDays: number; // Días Reales Restantes Estimados = SRM / ADR
  variationInDays: number; // Δt = Días Restantes Originales - Días Reales Restantes Estimados
  temporalBreakdown: TemporalDeltaBreakdown;
  startDate: string;
  originalTargetDate: string;
  projectedTargetDate: string;
  progressPercentage: number;
  isViable: boolean;
  viabilityAlert: {
    triggered: boolean;
    message: string;
    minRealisticDays: number;
    minRealisticWeeks: number;
    minRealisticMonths: number;
  };
}

export interface FinancialAnalysisOutput {
  cycleType: CycleType;
  cycleDays: number; // 15 para quincenal, 30 para mensual
  cycleIncome: number; // Ingreso del Ciclo
  monthlyNormalizedIncome: number;
  dailyIncome: number;
  totalCycleMandatoryExpenses: number; // Total Gastos Obligatorios del Ciclo
  totalMonthlyMandatoryExpenses: number;
  dailyMandatoryExpenses: number;
  paidMandatoryExpenses: number;
  pendingMandatoryExpenses: number;
  netAvailableIncome: number; // 1. IND = Ingreso del Ciclo - Total Gastos Obligatorios del Ciclo
  monthlyNetAvailableIncome: number;
  totalCycleRequiredSavings: number; // 4. Ahorro Requerido por Ciclo
  totalMonthlyRequiredSavings: number;
  totalDailyRequiredSavings: number;
  freeSpendingBudgetCycle: number; // 5. PGL = IND - Ahorro Requerido por Ciclo
  limits: {
    monthlyLimit: number; // Tope de Gasto Mensual: PGL_mensual
    weeklyLimit: number; // Tope de Gasto Semanal: PGL_mensual / 4.33
    weeklyLimitFromDaily: number; // Alternativa: PGL_diario * 7
    dailyLimit: number; // PGL_diario
    weekendLimit: number; // Tope de Gasto por Fin de Semana (configurable 50%-60% o 2/7)
    weekdayDailyLimit: number; // Gasto diario lunes a viernes
    weekendPercentageUsed: number;
  };
  primaryGoalProjection: GoalProjectionResult | null;
  allGoalsProjections: GoalProjectionResult[];
  globalViabilityAlert: {
    isViable: boolean;
    deficitPerCycle: number;
    message: string;
  };
}

/**
 * Convierte cualquier unidad de duración a Días Totales de la Meta (DTM)
 * Regla SRS 3.1.2: Semanas × 7 | Meses × 30 | Días × 1
 */
export function calculateTotalGoalDays(durationValue: number, durationUnit: DurationUnit): Decimal {
  const val = new Decimal(Math.max(1, durationValue));
  if (durationUnit === 'WEEKS') return val.mul(7);
  if (durationUnit === 'MONTHS') return val.mul(30);
  return val;
}

/**
 * Calcula el ingreso por ciclo cuando el usuario opera en Modo Salario (Ingreso Fijo)
 * Soporta frecuencia Quincenal, Mensual o Anual prorrateado.
 */
export function calculateCycleIncomeFromFixedSalary(
  fixedSalaryAmount: number | string,
  salaryFrequency: SalaryFrequency,
  targetCycleType: CycleType
): Decimal {
  const amount = new Decimal(fixedSalaryAmount || 0);
  // Primero normalizamos a base mensual (30 días)
  let monthlyIncome = amount;
  if (salaryFrequency === 'BIWEEKLY') {
    monthlyIncome = amount.mul(2);
  } else if (salaryFrequency === 'ANNUAL') {
    monthlyIncome = amount.div(12);
  }

  if (targetCycleType === 'BIWEEKLY') {
    return monthlyIncome.div(2).toDecimalPlaces(2);
  }
  return monthlyIncome.toDecimalPlaces(2);
}

/**
 * Normaliza un gasto obligatorio tanto a base diaria como al ciclo del usuario (15 o 30 días).
 * Regla SRS 2.3: "El sistema normaliza todos los gastos obligatorios a una base diaria y por ciclo
 * para restarlos del ingreso bruto antes de calcular el disponible."
 */
export function normalizeMandatoryExpense(
  amount: number | string,
  expenseFrequency: ExpenseFrequency,
  userCycleType: CycleType
): { cycleAmount: Decimal; dailyAmount: Decimal; monthlyAmount: Decimal } {
  const raw = new Decimal(amount || 0);
  const cycleDays = new Decimal(userCycleType === 'BIWEEKLY' ? 15 : 30);

  let dailyAmount: Decimal;
  if (expenseFrequency === 'BIWEEKLY') {
    dailyAmount = raw.div(15);
  } else if (expenseFrequency === 'MONTHLY') {
    dailyAmount = raw.div(30);
  } else {
    // 'ONCE' -> único en el período actual
    dailyAmount = raw.div(cycleDays);
  }

  const cycleAmount = dailyAmount.mul(cycleDays);
  const monthlyAmount = dailyAmount.mul(30);

  return {
    cycleAmount: cycleAmount.toDecimalPlaces(2),
    dailyAmount: dailyAmount.toDecimalPlaces(2),
    monthlyAmount: monthlyAmount.toDecimalPlaces(2),
  };
}

/**
 * Formatea la variación en días (Δt) en días, semanas y meses exactos
 * Regla SRS 3.2:
 * - Si Δt < 0 (gastó de más): Mostrar alerta en rojo/ámbar indicando exactamente cuántos días,
 *   semanas y meses de atraso representa ese gasto extra respecto a la fecha objetivo original.
 * - Si Δt > 0 (ahorró de más): Mostrar indicador positivo en verde indicando exactamente cuántos días,
 *   semanas y meses de adelanto ganó hacia la compra de su producto.
 */
export function buildTemporalDeltaBreakdown(deltaDaysDec: Decimal): TemporalDeltaBreakdown {
  const totalDays = deltaDaysDec.toDecimalPlaces(1).toNumber();
  const absDec = deltaDaysDec.abs();
  const absDays = absDec.toDecimalPlaces(1).toNumber();
  const weeksEquivalent = absDec.div(7).toDecimalPlaces(2).toNumber();
  const monthsEquivalent = absDec.div(30).toDecimalPlaces(2).toNumber();

  const wholeDays = Math.round(absDays);
  const formattedMonths = Math.floor(wholeDays / 30);
  const remAfterMonths = wholeDays % 30;
  const formattedWeeks = Math.floor(remAfterMonths / 7);
  const formattedRemainingDays = remAfterMonths % 7;

  if (Math.abs(totalDays) < 0.05) {
    return {
      totalDays: 0,
      absDays: 0,
      weeksEquivalent: 0,
      monthsEquivalent: 0,
      formattedMonths: 0,
      formattedWeeks: 0,
      formattedRemainingDays: 0,
      direction: 'ON_TRACK',
      summaryText: 'Al día con la fecha objetivo original (0 días de desviación)',
      badgeText: 'En meta exacta (0 días)',
    };
  }

  const isAhead = totalDays > 0;
  const sign = isAhead ? '+' : '-';
  const label = isAhead ? 'adelanto' : 'atraso';

  return {
    totalDays,
    absDays,
    weeksEquivalent,
    monthsEquivalent,
    formattedMonths,
    formattedWeeks,
    formattedRemainingDays,
    direction: isAhead ? 'AHEAD' : 'DELAYED',
    summaryText: `${absDays} días (${weeksEquivalent} semanas / ${monthsEquivalent} meses) de ${label}`,
    badgeText: `${sign}${absDays} días de ${label}`,
  };
}

/**
 * Ejecuta el Motor de Análisis, Proyección y Desviación Temporal completo según la Sección 3 del SRS.
 */
export function runFinancialProjectionEngine(params: {
  cycleType: CycleType;
  declaredCycleIncome: number | string;
  expenses: MandatoryExpenseInput[];
  goals: SavingsGoalInput[];
  checklists: ChecklistItemInput[];
  weekendPercentage?: number; // Por defecto 55% (rango 50%-60% del presupuesto semanal libre)
}): FinancialAnalysisOutput {
  const {
    cycleType,
    declaredCycleIncome,
    expenses,
    goals,
    checklists,
    weekendPercentage = 55,
  } = params;

  const cycleDays = new Decimal(cycleType === 'BIWEEKLY' ? 15 : 30);
  const cycleIncome = new Decimal(declaredCycleIncome || 0);
  const dailyIncome = cycleIncome.div(cycleDays);
  const monthlyNormalizedIncome = dailyIncome.mul(30);

  // Normalización de gastos obligatorios
  let totalCycleExpenses = new Decimal(0);
  let totalDailyExpenses = new Decimal(0);
  let totalMonthlyExpenses = new Decimal(0);
  let paidExpenses = new Decimal(0);
  let pendingExpenses = new Decimal(0);

  for (const exp of expenses) {
    const norm = normalizeMandatoryExpense(exp.amount, exp.frequency, cycleType);
    totalCycleExpenses = totalCycleExpenses.add(norm.cycleAmount);
    totalDailyExpenses = totalDailyExpenses.add(norm.dailyAmount);
    totalMonthlyExpenses = totalMonthlyExpenses.add(norm.monthlyAmount);

    if (exp.is_paid) {
      paidExpenses = paidExpenses.add(norm.cycleAmount);
    } else {
      pendingExpenses = pendingExpenses.add(norm.cycleAmount);
    }
  }

  // 1. Ingreso Neto Disponible (IND) = Ingreso del Ciclo − Total Gastos Obligatorios del Ciclo
  const IND = cycleIncome.sub(totalCycleExpenses);
  const monthlyIND = monthlyNormalizedIncome.sub(totalMonthlyExpenses);
  const dailyIND = IND.div(cycleDays);

  // Evaluamos cada meta activa
  const allGoalsProjections: GoalProjectionResult[] = [];
  let totalCycleRequiredSavings = new Decimal(0);
  let totalMonthlyRequiredSavings = new Decimal(0);
  let totalDailyRequiredSavings = new Decimal(0);

  for (const goal of goals) {
    const targetAmount = new Decimal(goal.target_amount || 0);
    const baseSavedAmount = Decimal.max(new Decimal(0), new Decimal(goal.saved_amount || 0));
    const netAmountToFinance = Decimal.max(new Decimal(0), targetAmount.sub(baseSavedAmount));
    const allocationPct = new Decimal(goal.allocation_pct ?? 100);

    // 2. Días Totales de la Meta (DTM) = Conversión del tiempo previsto a días (Semanas × 7 | Meses × 30)
    const DTM = calculateTotalGoalDays(goal.duration_value, goal.duration_unit);

    // 3. Ahorro Diario Requerido (ADR) = (Precio de la Meta - Ahorro Inicial) / DTM
    const ADR = DTM.gt(0) ? netAmountToFinance.div(DTM) : new Decimal(0);

    // 4. Ahorro Requerido por Ciclo = ADR × Días del Ciclo (15 para quincenal, 30 para mensual)
    const goalCycleRequiredSavings = ADR.mul(cycleDays);
    const goalMonthlyRequiredSavings = ADR.mul(30);

    totalCycleRequiredSavings = totalCycleRequiredSavings.add(goalCycleRequiredSavings);
    totalMonthlyRequiredSavings = totalMonthlyRequiredSavings.add(goalMonthlyRequiredSavings);
    totalDailyRequiredSavings = totalDailyRequiredSavings.add(ADR);

    // Filtramos checklists pertenecientes a esta meta
    const goalChecklists = checklists.filter((c) => c.goal_id === goal.id);

    // Cálculo de Ahorro Programado Transcurrido + Ahorros Extra - Excesos de Gasto (Sección 3.2)
    let scheduledDaysElapsed = new Decimal(0);
    let extraSavings = new Decimal(0);
    let overspentAmount = new Decimal(0);

    for (const item of goalChecklists) {
      const pDays = new Decimal(item.period_days || 7);
      scheduledDaysElapsed = scheduledDaysElapsed.add(pDays);

      const limit = new Decimal(item.budget_limit || 0);
      const spent = new Decimal(item.actual_spent || 0);
      const diff = limit.sub(spent); // Positivo si gastó menos del tope (ahorró extra), negativo si gastó de más

      if (item.status === 'SAVED_EXTRA' || diff.gt(0)) {
        extraSavings = extraSavings.add(diff.gt(0) ? diff : new Decimal(item.deviation || 0).abs());
      } else if (item.status === 'OVER_BUDGET' || diff.lt(0)) {
        overspentAmount = overspentAmount.add(
          diff.lt(0) ? diff.abs() : new Decimal(item.deviation || 0).abs()
        );
      }
    }

    // Ahorro Programado Transcurrido = (ADR * días de períodos completados en checklist) + abono inicial base
    const scheduledSavingsFromChecklists = ADR.mul(scheduledDaysElapsed);
    const scheduledSavingsElapsed = scheduledSavingsFromChecklists.add(baseSavedAmount);

    // Acumulado Real Ahorrado (ARA) = Ahorro Programado Transcurrido + Ahorros Extra − Excesos de Gasto
    const ARA = Decimal.max(
      new Decimal(0),
      scheduledSavingsElapsed.add(extraSavings).sub(overspentAmount)
    );

    // Saldo Restante para la Meta (SRM) = Precio de la Meta − ARA
    const SRM = Decimal.max(new Decimal(0), targetAmount.sub(ARA));

    // Días Restantes Originales = DTM - días transcurridos en checklists
    const originalRemainingDays = Decimal.max(new Decimal(0), DTM.sub(scheduledDaysElapsed));

    // Días Reales Restantes Estimados = SRM / Ahorro Diario Requerido (ADR)
    const estimatedRealRemainingDays = ADR.gt(0) ? SRM.div(ADR) : new Decimal(0);

    // Variación en Días (Δt) = Días Restantes Originales − Días Reales Restantes Estimados
    const variationInDays = originalRemainingDays.sub(estimatedRealRemainingDays);

    const temporalBreakdown = buildTemporalDeltaBreakdown(variationInDays);

    // Fechas original y proyectada
    const startDateObj = new Date(goal.start_date || Date.now());
    const originalTargetDateObj = new Date(
      startDateObj.getTime() + DTM.toNumber() * 24 * 60 * 60 * 1000
    );
    // Si Δt > 0 (adelanto), la fecha proyectada es antes (-Δt días). Si Δt < 0 (atraso), la fecha es después (-Δt días = +|Δt| días).
    const projectedTargetDateObj = new Date(
      originalTargetDateObj.getTime() - variationInDays.toNumber() * 24 * 60 * 60 * 1000
    );

    // Alerta de Viabilidad (Sección 3.1): Si Ahorro Requerido por Ciclo > IND
    const allocatedIND = IND.mul(allocationPct).div(100);
    const allocatedDailyIND = dailyIND.mul(allocationPct).div(100);
    const isViable = IND.gt(0) && goalCycleRequiredSavings.lte(allocatedIND);

    // Plazo mínimo realista sobre el monto neto restante a financiar (targetAmount - baseSavedAmount)
    let minRealisticDays = DTM.toNumber();
    if (allocatedDailyIND.gt(0)) {
      minRealisticDays = Math.max(1, Math.ceil(netAmountToFinance.div(allocatedDailyIND).toNumber()));
    } else if (dailyIND.gt(0)) {
      minRealisticDays = Math.max(1, Math.ceil(netAmountToFinance.div(dailyIND).toNumber()));
    }
    const minRealisticWeeks = Number((minRealisticDays / 7).toFixed(1));
    const minRealisticMonths = Number((minRealisticDays / 30).toFixed(1));

    let viabilityMessage = 'La meta es 100% viable dentro de tu capacidad actual de ahorro.';
    if (IND.lte(0)) {
      viabilityMessage =
        'Tus gastos obligatorios igualan o superan el ingreso del ciclo. Debes reducir gastos o incrementar ingresos para poder ahorrar.';
    } else if (!isViable) {
      viabilityMessage = `Alerta de Viabilidad: El ahorro requerido por ciclo superaría tu Ingreso Neto Disponible. El plazo mínimo realista destinando el 100% de tu disponible es de ${minRealisticDays} días (${minRealisticWeeks} semanas / ${minRealisticMonths} meses).`;
    }

    const progressPct = targetAmount.gt(0)
      ? Decimal.min(100, Decimal.max(0, ARA.div(targetAmount).mul(100)))
          .toDecimalPlaces(1)
          .toNumber()
      : 0;

    allGoalsProjections.push({
      goalId: goal.id,
      productName: goal.product_name,
      targetAmount: targetAmount.toDecimalPlaces(2).toNumber(),
      allocationPct: allocationPct.toDecimalPlaces(2).toNumber(),
      totalGoalDays: DTM.toNumber(),
      dailyRequiredSavings: ADR.toDecimalPlaces(2).toNumber(),
      cycleRequiredSavings: goalCycleRequiredSavings.toDecimalPlaces(2).toNumber(),
      monthlyRequiredSavings: goalMonthlyRequiredSavings.toDecimalPlaces(2).toNumber(),
      scheduledSavingsElapsed: scheduledSavingsElapsed.toDecimalPlaces(2).toNumber(),
      extraSavingsTotal: extraSavings.toDecimalPlaces(2).toNumber(),
      overspentTotal: overspentAmount.toDecimalPlaces(2).toNumber(),
      accumulatedRealSavings: ARA.toDecimalPlaces(2).toNumber(),
      remainingBalance: SRM.toDecimalPlaces(2).toNumber(),
      originalRemainingDays: originalRemainingDays.toDecimalPlaces(1).toNumber(),
      estimatedRealRemainingDays: estimatedRealRemainingDays.toDecimalPlaces(1).toNumber(),
      variationInDays: variationInDays.toDecimalPlaces(1).toNumber(),
      temporalBreakdown,
      startDate: startDateObj.toISOString(),
      originalTargetDate: originalTargetDateObj.toISOString(),
      projectedTargetDate: projectedTargetDateObj.toISOString(),
      progressPercentage: progressPct,
      isViable,
      viabilityAlert: {
        triggered: !isViable,
        message: viabilityMessage,
        minRealisticDays,
        minRealisticWeeks,
        minRealisticMonths,
      },
    });
  }

  // 5. Presupuesto de Gasto Libre por Ciclo (PGL) = IND − Ahorro Requerido por Ciclo
  const PGL_cycle = IND.sub(totalCycleRequiredSavings);
  const PGL_daily = PGL_cycle.div(cycleDays);
  const PGL_mensual = PGL_daily.mul(30);

  // Límites sugeridos según Sección 3.1:
  // - Tope de Gasto Mensual: PGL_mensual
  // - Tope de Gasto Semanal: PGL_mensual / 4.33 (o PGL_diario * 7)
  // - Tope de Gasto por Fin de Semana: Asignación configurable (por defecto 50%-60% del presupuesto semanal libre)
  const safeMonthlyPGL = Decimal.max(new Decimal(0), PGL_mensual);
  const safeDailyPGL = Decimal.max(new Decimal(0), PGL_daily);
  const weeklyLimit = safeMonthlyPGL.div(new Decimal('4.33'));
  const weeklyLimitFromDaily = safeDailyPGL.mul(7);

  const clampedWeekendPct = new Decimal(Math.min(80, Math.max(20, weekendPercentage)));
  const weekendLimit = weeklyLimit.mul(clampedWeekendPct).div(100);
  const weekdayDailyLimit = weeklyLimit.sub(weekendLimit).div(5);

  const primaryGoalProjection =
    allGoalsProjections.find((g) => {
      const found = goals.find((raw) => raw.id === g.goalId);
      return found?.is_primary;
    }) ||
    allGoalsProjections[0] ||
    null;

  const isGlobalViable = IND.gt(0) && totalCycleRequiredSavings.lte(IND);
  const deficitPerCycle = totalCycleRequiredSavings.gt(IND)
    ? totalCycleRequiredSavings.sub(IND).toDecimalPlaces(2).toNumber()
    : 0;

  return {
    cycleType,
    cycleDays: cycleDays.toNumber(),
    cycleIncome: cycleIncome.toDecimalPlaces(2).toNumber(),
    monthlyNormalizedIncome: monthlyNormalizedIncome.toDecimalPlaces(2).toNumber(),
    dailyIncome: dailyIncome.toDecimalPlaces(2).toNumber(),
    totalCycleMandatoryExpenses: totalCycleExpenses.toDecimalPlaces(2).toNumber(),
    totalMonthlyMandatoryExpenses: totalMonthlyExpenses.toDecimalPlaces(2).toNumber(),
    dailyMandatoryExpenses: totalDailyExpenses.toDecimalPlaces(2).toNumber(),
    paidMandatoryExpenses: paidExpenses.toDecimalPlaces(2).toNumber(),
    pendingMandatoryExpenses: pendingExpenses.toDecimalPlaces(2).toNumber(),
    netAvailableIncome: IND.toDecimalPlaces(2).toNumber(),
    monthlyNetAvailableIncome: monthlyIND.toDecimalPlaces(2).toNumber(),
    totalCycleRequiredSavings: totalCycleRequiredSavings.toDecimalPlaces(2).toNumber(),
    totalMonthlyRequiredSavings: totalMonthlyRequiredSavings.toDecimalPlaces(2).toNumber(),
    totalDailyRequiredSavings: totalDailyRequiredSavings.toDecimalPlaces(2).toNumber(),
    freeSpendingBudgetCycle: PGL_cycle.toDecimalPlaces(2).toNumber(),
    limits: {
      monthlyLimit: safeMonthlyPGL.toDecimalPlaces(2).toNumber(),
      weeklyLimit: weeklyLimit.toDecimalPlaces(2).toNumber(),
      weeklyLimitFromDaily: weeklyLimitFromDaily.toDecimalPlaces(2).toNumber(),
      dailyLimit: safeDailyPGL.toDecimalPlaces(2).toNumber(),
      weekendLimit: weekendLimit.toDecimalPlaces(2).toNumber(),
      weekdayDailyLimit: weekdayDailyLimit.toDecimalPlaces(2).toNumber(),
      weekendPercentageUsed: clampedWeekendPct.toNumber(),
    },
    primaryGoalProjection,
    allGoalsProjections,
    globalViabilityAlert: {
      isViable: isGlobalViable,
      deficitPerCycle,
      message: isGlobalViable
        ? 'Tu plan financiero está equilibrado y es viable.'
        : `Alerta de Viabilidad: El ahorro requerido por ciclo supera tu Ingreso Neto Disponible por ${deficitPerCycle}. Ajusta el plazo de tu meta o reduce gastos.`,
    },
  };
}

/**
 * Calcula el impacto exacto en días (days_impact) de un registro individual del checklist:
 * - ON_TRACK (Cumplí el presupuesto): Desviación = 0 -> days_impact = 0
 * - SAVED_EXTRA (Ahorré de más): +AhorroExtra / ADR -> días positivos de adelanto
 * - OVER_BUDGET (Gasté de más): -Exceso / ADR -> días negativos de atraso
 */
export function calculateChecklistItemImpact(params: {
  status: ChecklistStatus;
  budgetLimit: number | string;
  actualSpent?: number | string;
  extraAmountOrOverspent?: number | string;
  dailyRequiredSavings: number | string;
}): {
  budgetLimit: Decimal;
  actualSpent: Decimal;
  deviation: Decimal;
  daysImpact: Decimal;
} {
  const limit = new Decimal(params.budgetLimit || 0);
  const adr = new Decimal(params.dailyRequiredSavings || 0);

  let spent = limit;
  let deviation = new Decimal(0); // Positivo = ahorro extra, Negativo = exceso de gasto

  if (params.status === 'ON_TRACK') {
    spent = limit;
    deviation = new Decimal(0);
  } else if (params.status === 'SAVED_EXTRA') {
    if (params.extraAmountOrOverspent !== undefined) {
      const savedExtra = new Decimal(params.extraAmountOrOverspent || 0).abs();
      spent = Decimal.max(new Decimal(0), limit.sub(savedExtra));
      deviation = savedExtra;
    } else if (params.actualSpent !== undefined) {
      spent = new Decimal(params.actualSpent || 0);
      deviation = Decimal.max(new Decimal(0), limit.sub(spent));
    }
  } else if (params.status === 'OVER_BUDGET') {
    if (params.extraAmountOrOverspent !== undefined) {
      const overspent = new Decimal(params.extraAmountOrOverspent || 0).abs();
      spent = limit.add(overspent);
      deviation = overspent.negated();
    } else if (params.actualSpent !== undefined) {
      spent = new Decimal(params.actualSpent || 0);
      deviation = Decimal.min(new Decimal(0), limit.sub(spent));
    }
  }

  const daysImpact = adr.gt(0) ? deviation.div(adr).toDecimalPlaces(2) : new Decimal(0);

  return {
    budgetLimit: limit.toDecimalPlaces(2),
    actualSpent: spent.toDecimalPlaces(2),
    deviation: deviation.toDecimalPlaces(2),
    daysImpact,
  };
}
