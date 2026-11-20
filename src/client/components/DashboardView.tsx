import React from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  PiggyBank,
  Sliders,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest, WorkspaceState } from '../api';
import { formatCurrency } from '../../shared/currency';

interface DashboardViewProps {
  workspace: WorkspaceState;
  onUpdateWorkspace: (ws: WorkspaceState) => void;
  onNavigateView: (
    view: 'DASHBOARD' | 'CHECKLIST' | 'EXPENSES' | 'GOALS' | 'GLOSSARY'
  ) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  workspace,
  onUpdateWorkspace,
  onNavigateView,
}) => {
  const { user, activeCycle, analysis } = workspace;
  const cur = user.currency;
  const primaryGoal = analysis.primaryGoalProjection;

  const handleWeekendPercentageChange = async (newPct: number) => {
    try {
      const ws = await apiRequest<WorkspaceState>('/profile', {
        method: 'PUT',
        body: JSON.stringify({ weekend_percentage: newPct }),
      });
      onUpdateWorkspace(ws);
    } catch (err) {
      console.error(err);
    }
  };

  // Paleta sobria Zinc + Esmeralda en gráficas
  const distributionData = [
    {
      name: 'Gastos Fijos',
      valor: Math.max(0, analysis.totalCycleMandatoryExpenses),
      color: '#3F3F46', // Zinc 700
    },
    {
      name: 'Ahorro Meta',
      valor: Math.max(0, analysis.totalCycleRequiredSavings),
      color: '#10B981', // Emerald 500
    },
    {
      name: 'Gasto Libre (PGL)',
      valor: Math.max(0, analysis.freeSpendingBudgetCycle),
      color: '#A1A1AA', // Zinc 400
    },
  ];

  const limitsChartData = [
    {
      periodo: 'Hoy',
      monto: analysis.limits.dailyLimit,
      color: '#10B981',
    },
    {
      periodo: 'Fin de Semana',
      monto: analysis.limits.weekendLimit,
      color: '#10B981',
    },
    {
      periodo: 'Semanal',
      monto: analysis.limits.weeklyLimit,
      color: '#52525B',
    },
    {
      periodo: 'Mensual',
      monto: analysis.limits.monthlyLimit,
      color: '#3F3F46',
    },
  ];

  const formatDateEs = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getSafeStartDate = () => {
    if (primaryGoal?.startDate) return primaryGoal.startDate;
    if (primaryGoal?.originalTargetDate && primaryGoal?.totalGoalDays) {
      const targetMs = new Date(primaryGoal.originalTargetDate).getTime();
      const startMs = targetMs - primaryGoal.totalGoalDays * 24 * 60 * 60 * 1000;
      return new Date(startMs).toISOString();
    }
    return undefined;
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal Sobrio */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121215] border border-[#27272A] rounded-xl p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="px-2 py-0.5 rounded-md bg-[#09090B] border border-[#27272A] text-zinc-300 font-medium">
              {user.income_mode === 'FIXED' ? 'Ingreso Fijo (Salario)' : 'Ingreso Variable'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#09090B] border border-[#27272A] text-zinc-400">
              Ciclo {user.cycle_type === 'BIWEEKLY' ? 'Quincenal (15d)' : 'Mensual (30d)'}
            </span>
            <span className="text-zinc-500">
              {activeCycle.period_name}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-white mt-2 tracking-tight">
            Resumen Financiero
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateView('CHECKLIST')}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={1.5} />
            Registrar Control
          </button>
          <button
            type="button"
            onClick={() => onNavigateView('GLOSSARY')}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-lg bg-[#09090B] hover:bg-zinc-900 text-zinc-300 text-xs font-medium border border-[#27272A] transition flex items-center gap-1.5"
          >
            <BookOpen className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
            Glosario
          </button>
        </div>
      </div>

      {/* ALERTA DE VIABILIDAD (Reservado rojo/ámbar estrictamente para alertas reales) */}
      {primaryGoal && primaryGoal.viabilityAlert.triggered && (
        <div
          data-testid="viability-alert-banner"
          className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-amber-200">
                Ajuste de Plazo Recomendado
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                {primaryGoal.viabilityAlert.message}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] tabular-nums">
                <span className="px-2 py-0.5 rounded bg-[#09090B] border border-amber-500/30 text-amber-200">
                  Mínimo sugerido: {primaryGoal.viabilityAlert.minRealisticDays} días
                </span>
                <span className="px-2 py-0.5 rounded bg-[#09090B] border border-amber-500/30 text-amber-200">
                  {primaryGoal.viabilityAlert.minRealisticWeeks} semanas
                </span>
                <span className="px-2 py-0.5 rounded bg-[#09090B] border border-amber-500/30 text-amber-200">
                  {primaryGoal.viabilityAlert.minRealisticMonths} meses
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateView('GOALS')}
            className="w-full md:w-auto px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium shrink-0 transition"
          >
            Ajustar Meta
          </button>
        </div>
      )}

      {/* =====================================================================
          JERARQUÍA VISUAL: HERO METRICS ('Disponible Hoy' y 'Tope Fin de Semana')
          + Indicadores Secundarios Compactos
         ===================================================================== */}
      <div className="bg-[#121215] border border-[#27272A] rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#27272A]">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Capacidad de Gasto
            </span>
            <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
              Topes de Gasto Libre
            </h2>
          </div>

          <div className="flex items-center gap-3 bg-[#09090B] px-3.5 py-2 rounded-lg border border-[#27272A]">
            <Sliders className="w-4 h-4 text-zinc-500 shrink-0" strokeWidth={1.5} />
            <div className="text-xs w-full sm:w-auto">
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400">Fin de Semana:</span>
                <span className="font-medium text-white tabular-nums">
                  {analysis.limits.weekendPercentageUsed}% semanal
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={75}
                step={5}
                value={analysis.limits.weekendPercentageUsed}
                onChange={(e) => handleWeekendPercentageChange(Number(e.target.value))}
                className="w-full sm:w-40 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-1.5"
              />
            </div>
          </div>
        </div>

        {/* FILA PRINCIPAL (HERO METRICS): Disponible Hoy y Tope Fin de Semana */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            data-testid="limit-today"
            className="p-5 sm:p-6 rounded-xl bg-[#09090B] border border-[#27272A] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Disponible Hoy</span>
              <Clock className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
            </div>
            <div className="mt-3">
              <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-white tabular-nums">
                {formatCurrency(analysis.limits.dailyLimit, cur)}
              </div>
              <p className="text-xs text-zinc-500 mt-2 tabular-nums">
                Ritmo Lun–Vie sugerido: {formatCurrency(analysis.limits.weekdayDailyLimit, cur)} / día
              </p>
            </div>
          </div>

          <div
            data-testid="limit-weekend"
            className="p-5 sm:p-6 rounded-xl bg-[#09090B] border border-[#27272A] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Tope Fin de Semana</span>
              <CalendarDays className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
            </div>
            <div className="mt-3">
              <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-white tabular-nums">
                {formatCurrency(analysis.limits.weekendLimit, cur)}
              </div>
              <p className="text-xs text-zinc-500 mt-2 tabular-nums">
                Sábado y Domingo ({analysis.limits.weekendPercentageUsed}% de tu presupuesto semanal)
              </p>
            </div>
          </div>
        </div>

        {/* FILA SECUNDARIA COMPACTA: Tope Semanal y Tope Mensual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div
            data-testid="limit-weekly"
            className="px-4 py-3 rounded-lg bg-[#09090B]/70 border border-[#27272A] flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
              <div>
                <span className="text-xs text-zinc-400 block">Tope Semanal</span>
                <span className="text-[11px] text-zinc-500">Presupuesto mensual ÷ 4.33</span>
              </div>
            </div>
            <div className="text-base font-semibold text-white tabular-nums">
              {formatCurrency(analysis.limits.weeklyLimit, cur)}
            </div>
          </div>

          <div
            data-testid="limit-monthly"
            className="px-4 py-3 rounded-lg bg-[#09090B]/70 border border-[#27272A] flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
              <div>
                <span className="text-xs text-zinc-400 block">Tope Mensual</span>
                <span className="text-[11px] text-zinc-500">Presupuesto libre a 30 días</span>
              </div>
            </div>
            <div className="text-base font-semibold text-white tabular-nums">
              {formatCurrency(analysis.limits.monthlyLimit, cur)}
            </div>
          </div>
        </div>
      </div>

      {/* INDICADORES SECUNDARIOS COMPACTOS DEL CICLO (Ingreso, Gastos Fijos, Ahorro, PGL) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          data-testid="card-cycle-income"
          className="p-4 rounded-xl bg-[#121215] border border-[#27272A] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Ingreso del Ciclo</span>
            <Wallet className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
          </div>
          <div className="mt-2">
            <div className="text-lg font-semibold text-white tabular-nums">
              {formatCurrency(analysis.cycleIncome, cur)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
              {formatCurrency(analysis.dailyIncome, cur)} / día
            </p>
          </div>
        </div>

        <div
          data-testid="card-mandatory-expenses"
          className="p-4 rounded-xl bg-[#121215] border border-[#27272A] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Gastos Fijos</span>
            <CreditCard className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
          </div>
          <div className="mt-2">
            <div className="text-lg font-semibold text-white tabular-nums">
              {formatCurrency(analysis.totalCycleMandatoryExpenses, cur)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
              IND: <span className="text-zinc-300">{formatCurrency(analysis.netAvailableIncome, cur)}</span>
            </p>
          </div>
        </div>

        <div
          data-testid="card-required-savings"
          className="p-4 rounded-xl bg-[#121215] border border-[#27272A] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Ahorro Requerido</span>
            <PiggyBank className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
          </div>
          <div className="mt-2">
            <div className="text-lg font-semibold text-white tabular-nums">
              {formatCurrency(analysis.totalCycleRequiredSavings, cur)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
              ADR: <span className="text-zinc-300">{formatCurrency(analysis.totalDailyRequiredSavings, cur)}/día</span>
            </p>
          </div>
        </div>

        <div
          data-testid="card-free-budget"
          className="p-4 rounded-xl bg-[#121215] border border-[#27272A] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Presupuesto Libre (PGL)</span>
            <Wallet className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
          </div>
          <div className="mt-2">
            <div
              className={`text-lg font-semibold tabular-nums ${
                analysis.freeSpendingBudgetCycle >= 0 ? 'text-white' : 'text-rose-400'
              }`}
            >
              {formatCurrency(analysis.freeSpendingBudgetCycle, cur)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Disponible en este ciclo
            </p>
          </div>
        </div>
      </div>

      {/* PROGRESO DE META PRINCIPAL */}
      {primaryGoal ? (
        <div
          data-testid="goal-thermometer-section"
          className="bg-[#121215] border border-[#27272A] rounded-xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Progreso de Meta
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-white mt-1 tabular-nums">
                {primaryGoal.productName} —{' '}
                <span className="text-white">
                  {formatCurrency(primaryGoal.targetAmount, cur)}
                </span>
              </h2>
            </div>

            <div
              data-testid="goal-dynamic-badge"
              className={`px-3.5 py-2 rounded-lg border font-medium text-xs flex items-center gap-1.5 self-start lg:self-auto tabular-nums ${
                primaryGoal.variationInDays > 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : primaryGoal.variationInDays < 0
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : 'bg-[#09090B] border-[#27272A] text-zinc-300'
              }`}
            >
              {primaryGoal.variationInDays > 0 ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
              ) : primaryGoal.variationInDays < 0 ? (
                <ArrowDownRight className="w-4 h-4 text-rose-400" strokeWidth={1.5} />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
              )}
              <span>{primaryGoal.temporalBreakdown.badgeText}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs tabular-nums">
              <span className="text-zinc-400">
                Ahorro Acumulado (ARA):{' '}
                <strong className="text-white font-semibold">
                  {formatCurrency(primaryGoal.accumulatedRealSavings, cur)}
                </strong>
              </span>
              <span className="text-zinc-400">
                {primaryGoal.progressPercentage}% · Restante (SRM):{' '}
                <strong className="text-white font-semibold">
                  {formatCurrency(primaryGoal.remainingBalance, cur)}
                </strong>
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#09090B] rounded-full overflow-hidden border border-[#27272A]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  primaryGoal.variationInDays < 0 ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(3, primaryGoal.progressPercentage)}%` }}
              />
            </div>
          </div>

          {primaryGoal.variationInDays < 0 && (
            <div
              data-testid="delay-alert-box"
              className="p-4 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-200 flex items-start gap-3"
            >
              <TrendingDown className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="text-xs leading-relaxed tabular-nums">
                <div className="font-semibold text-rose-300">
                  Desfase en Fecha Objetivo (Δt = {primaryGoal.variationInDays} días)
                </div>
                <p className="mt-0.5 text-rose-200/90">
                  Por un exceso de gasto acumulado de{' '}
                  <strong>{formatCurrency(primaryGoal.overspentTotal, cur)}</strong> sobre tu tope
                  libre, tu meta presenta{' '}
                  <strong data-testid="delay-days-exact">
                    {primaryGoal.temporalBreakdown.absDays} días
                  </strong>
                  ,{' '}
                  <strong data-testid="delay-weeks-exact">
                    {primaryGoal.temporalBreakdown.weeksEquivalent} semanas
                  </strong>{' '}
                  y{' '}
                  <strong data-testid="delay-months-exact">
                    {primaryGoal.temporalBreakdown.monthsEquivalent} meses
                  </strong>{' '}
                  de atraso respecto a la fecha inicial.
                </p>
              </div>
            </div>
          )}

          {primaryGoal.variationInDays > 0 && (
            <div
              data-testid="ahead-alert-box"
              className="p-4 rounded-lg bg-emerald-950/25 border border-emerald-500/30 text-emerald-200 flex items-start gap-3"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="text-xs leading-relaxed tabular-nums">
                <div className="font-semibold text-emerald-300">
                  Meta Adelantada (Δt = +{primaryGoal.variationInDays} días)
                </div>
                <p className="mt-0.5 text-emerald-200/90">
                  Gracias a tu ahorro extra acumulado de{' '}
                  <strong>{formatCurrency(primaryGoal.extraSavingsTotal, cur)}</strong>, has ganado{' '}
                  <strong data-testid="ahead-days-exact">
                    {primaryGoal.temporalBreakdown.absDays} días
                  </strong>
                  ,{' '}
                  <strong data-testid="ahead-weeks-exact">
                    {primaryGoal.temporalBreakdown.weeksEquivalent} semanas
                  </strong>{' '}
                  y{' '}
                  <strong data-testid="ahead-months-exact">
                    {primaryGoal.temporalBreakdown.monthsEquivalent} meses
                  </strong>{' '}
                  de adelanto hacia tu meta.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A]">
              <span className="text-[11px] text-zinc-500">Inicio del Plan</span>
              <div className="text-xs sm:text-sm font-semibold text-white mt-1 tabular-nums">
                {formatDateEs(getSafeStartDate())}
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                Plazo total: {primaryGoal.totalGoalDays} días
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A]">
              <span className="text-[11px] text-zinc-500">Fecha Meta Original</span>
              <div className="text-xs sm:text-sm font-semibold text-white mt-1 tabular-nums">
                {formatDateEs(primaryGoal.originalTargetDate)}
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                Meta fija planeada
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A]">
              <span className="text-[11px] text-zinc-500">Fecha Meta Estimada</span>
              <div
                className={`text-xs sm:text-sm font-semibold mt-1 tabular-nums ${
                  primaryGoal.variationInDays < 0
                    ? 'text-rose-400'
                    : primaryGoal.variationInDays > 0
                      ? 'text-emerald-400'
                      : 'text-white'
                }`}
              >
                {formatDateEs(primaryGoal.projectedTargetDate)}
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                {primaryGoal.variationInDays === 0
                  ? 'Igual a original (0d variación)'
                  : `Restan ${primaryGoal.estimatedRealRemainingDays} días reales`}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A]">
              <span className="text-[11px] text-zinc-500">Ahorro Base + Extra</span>
              <div className="text-xs sm:text-sm font-semibold text-white mt-1 tabular-nums">
                {formatCurrency(primaryGoal.scheduledSavingsElapsed, cur)} +{' '}
                {formatCurrency(primaryGoal.extraSavingsTotal, cur)}
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                ADR: {formatCurrency(primaryGoal.dailyRequiredSavings, cur)}/día
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A] col-span-2 lg:col-span-1">
              <span className="text-[11px] text-zinc-500">Excesos de Gasto</span>
              <div
                className={`text-xs sm:text-sm font-semibold mt-1 tabular-nums ${
                  primaryGoal.overspentTotal > 0 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {primaryGoal.overspentTotal > 0
                  ? `-${formatCurrency(primaryGoal.overspentTotal, cur)}`
                  : formatCurrency(0, cur)}
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                Desviación acumulada
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#121215] border border-[#27272A] rounded-xl p-8 text-center">
          <Target className="w-6 h-6 text-zinc-500 mx-auto mb-2.5" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-white">No tienes una meta de compra activa</h3>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Crea tu primera meta de ahorro para visualizar tu progreso y proyección de fechas.
          </p>
          <button
            type="button"
            onClick={() => onNavigateView('GOALS')}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
          >
            Crear Meta
          </button>
        </div>
      )}

      {/* GRÁFICAS SOBRIAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#121215] border border-[#27272A] rounded-xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Comparativa de Topes de Gasto
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            Límites sugeridos por período ({cur})
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={limitsChartData} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                <XAxis dataKey="periodo" stroke="#71717A" fontSize={11} />
                <YAxis stroke="#71717A" fontSize={11} />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val), cur), 'Tope Permitido']}
                  contentStyle={{
                    backgroundColor: '#121215',
                    borderColor: '#27272A',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#FAFAFA',
                  }}
                />
                <Bar dataKey="monto" radius={[4, 4, 0, 0]}>
                  {limitsChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#121215] border border-[#27272A] rounded-xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1 tabular-nums">
            Distribución del Presupuesto ({formatCurrency(analysis.cycleIncome, cur)})
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            Proporción entre gastos fijos, ahorro requerido y presupuesto libre
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="valor"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                  stroke="#121215"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => formatCurrency(Number(val), cur)}
                  contentStyle={{
                    backgroundColor: '#121215',
                    borderColor: '#27272A',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#FAFAFA',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#A1A1AA' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
