import React from 'react';
import {
  BookOpen,
  Calculator,
  CalendarDays,
  Clock,
  PiggyBank,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { WorkspaceState } from '../api';
import { formatCurrency } from '../../shared/currency';

interface GlossaryViewProps {
  workspace: WorkspaceState;
}

export const GlossaryView: React.FC<GlossaryViewProps> = ({ workspace }) => {
  const { user, analysis } = workspace;
  const cur = user.currency;
  const primaryGoal = analysis.primaryGoalProjection;

  const acronyms = [
    {
      code: 'IND',
      name: 'Ingreso Neto Disponible',
      category: 'Presupuesto Base',
      icon: Wallet,
      meaning:
        'Es el dinero real que te queda libre en tu ciclo después de cubrir todos tus gastos y compromisos obligatorios (arriendo, servicios, transporte, alimentación).',
      formula: 'IND = Ingreso del Ciclo − Total Gastos Obligatorios del Ciclo',
      currentValue: formatCurrency(analysis.netAvailableIncome, cur),
      calculationDetail: `${formatCurrency(analysis.cycleIncome, cur)} − ${formatCurrency(
        analysis.totalCycleMandatoryExpenses,
        cur
      )} = ${formatCurrency(analysis.netAvailableIncome, cur)}`,
    },
    {
      code: 'DTM',
      name: 'Días Totales de la Meta',
      category: 'Planificación de Meta',
      icon: CalendarDays,
      meaning:
        'Es la conversión del plazo que elegiste para tu meta (en días, semanas o meses) a una medida estándar en días calendario para calcular tu cuota diaria exacta.',
      formula: 'DTM = Días × 1  |  Semanas × 7  |  Meses × 30',
      currentValue: primaryGoal ? `${primaryGoal.totalGoalDays} días` : 'Sin meta activa',
      calculationDetail: primaryGoal
        ? `Plazo total configurado equivalente a ${primaryGoal.totalGoalDays} días`
        : 'Crea una meta para ver el cálculo',
    },
    {
      code: 'ADR',
      name: 'Ahorro Diario Requerido',
      category: 'Ritmo de Ahorro',
      icon: PiggyBank,
      meaning:
        'Es la cuota diaria exacta que debes reservar para alcanzar el monto pendiente de tu meta (descontando cualquier ahorro inicial previo) exactamente en la fecha prevista. También sirve para medir cuántos días ganas o pierdes cuando ahorras extra o gastas de más.',
      formula: 'ADR = (Precio Objetivo − Ahorro Inicial) / DTM',
      currentValue: `${formatCurrency(analysis.totalDailyRequiredSavings, cur)} / día`,
      calculationDetail: primaryGoal
        ? `${formatCurrency(primaryGoal.targetAmount, cur)} (neto a financiar) / ${
            primaryGoal.totalGoalDays
          } días = ${formatCurrency(primaryGoal.dailyRequiredSavings, cur)}/día`
        : 'Crea una meta para ver el cálculo',
    },
    {
      code: 'PGL',
      name: 'Presupuesto de Gasto Libre por Ciclo',
      category: 'Capacidad de Gasto',
      icon: Wallet,
      meaning:
        'Es el monto que puedes gastar libremente durante tu ciclo (quincenal o mensual) en ocio, gustos o imprevistos después de haber separado tus gastos fijos y el ahorro obligatorio de tu meta.',
      formula: 'PGL = IND − (ADR × Días del Ciclo)',
      currentValue: formatCurrency(analysis.freeSpendingBudgetCycle, cur),
      calculationDetail: `${formatCurrency(analysis.netAvailableIncome, cur)} − ${formatCurrency(
        analysis.totalCycleRequiredSavings,
        cur
      )} = ${formatCurrency(analysis.freeSpendingBudgetCycle, cur)}`,
    },
    {
      code: 'PGL Mensual',
      name: 'Tope de Gasto Libre Mensual',
      category: 'Límites Sugeridos',
      icon: Calculator,
      meaning:
        'Es tu capacidad de gasto libre proyectada a un mes estándar de 30 días, utilizada como base para desglosar tus topes semanales y de fin de semana.',
      formula: 'PGL Mensual = PGL Diario × 30',
      currentValue: formatCurrency(analysis.limits.monthlyLimit, cur),
      calculationDetail: `Tope semanal = PGL Mensual ÷ 4.33 (${formatCurrency(
        analysis.limits.weeklyLimit,
        cur
      )}) · Fin de semana (${analysis.limits.weekendPercentageUsed}%) = ${formatCurrency(
        analysis.limits.weekendLimit,
        cur
      )}`,
    },
    {
      code: 'ARA',
      name: 'Acumulado Real Ahorrado',
      category: 'Seguimiento Real',
      icon: Target,
      meaning:
        'Es el saldo real que llevas acumulado hacia tu meta tomando en cuenta el ahorro programado de los períodos cumplidos, más tus ahorros extra, menos cualquier exceso de gasto.',
      formula: 'ARA = Ahorro Programado Transcurrido + Ahorros Extra − Excesos de Gasto',
      currentValue: primaryGoal
        ? formatCurrency(primaryGoal.accumulatedRealSavings, cur)
        : formatCurrency(0, cur),
      calculationDetail: primaryGoal
        ? `${formatCurrency(primaryGoal.scheduledSavingsElapsed, cur)} + ${formatCurrency(
            primaryGoal.extraSavingsTotal,
            cur
          )} − ${formatCurrency(primaryGoal.overspentTotal, cur)} = ${formatCurrency(
            primaryGoal.accumulatedRealSavings,
            cur
          )}`
        : 'Sin registros aún',
    },
    {
      code: 'SRM',
      name: 'Saldo Restante para la Meta',
      category: 'Seguimiento Real',
      icon: Clock,
      meaning:
        'Es el dinero que todavía te falta reunir para completar el precio total de tu objetivo de compra.',
      formula: 'SRM = Precio Objetivo de la Meta − ARA',
      currentValue: primaryGoal
        ? formatCurrency(primaryGoal.remainingBalance, cur)
        : formatCurrency(0, cur),
      calculationDetail: primaryGoal
        ? `${formatCurrency(primaryGoal.targetAmount, cur)} − ${formatCurrency(
            primaryGoal.accumulatedRealSavings,
            cur
          )} = ${formatCurrency(primaryGoal.remainingBalance, cur)}`
        : 'Sin meta activa',
    },
    {
      code: 'Δt',
      name: 'Variación Temporal (Días de Adelanto o Atraso)',
      category: 'Impacto en Tiempo',
      icon: TrendingUp,
      meaning:
        'Mide exactamente cuántos días se adelanta (Δt > 0) o se atrasa (Δt < 0) la fecha de compra de tu meta según tu comportamiento real de gasto en cada período.',
      formula: 'Δt = Días Restantes Originales − (SRM / ADR)',
      currentValue: primaryGoal ? primaryGoal.temporalBreakdown.badgeText : '0 días',
      calculationDetail: primaryGoal
        ? `${primaryGoal.originalRemainingDays} días orig. − ${primaryGoal.estimatedRealRemainingDays} días reales est. = ${primaryGoal.variationInDays} días`
        : 'Registra tu control semanal para calcular Δt',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado limpio y sobrio */}
      <div className="bg-[#121215] border border-[#27272A] rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Guía Financiera
          </span>
          <h1 className="text-lg sm:text-xl font-semibold text-white mt-0.5 tracking-tight">
            Glosario de Indicadores y Fórmulas
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Significado de cada acrónimo financiero de tu panel y cómo se calcula con tus datos en
            tiempo real.
          </p>
        </div>
        <BookOpen className="w-5 h-5 text-zinc-500 shrink-0" strokeWidth={1.5} />
      </div>

      {/* Tarjetas de Acrónimos y Fórmulas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {acronyms.map((item) => {
          const IconComponent = item.icon;
          return (
            <div
              key={item.code}
              data-testid={`acronym-card-${item.code}`}
              className="bg-[#121215] border border-[#27272A] rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-md bg-[#09090B] border border-[#27272A] text-white font-semibold text-xs tracking-tight font-mono">
                      {item.code}
                    </span>
                    <div>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 block">
                        {item.category}
                      </span>
                      <h2 className="text-sm font-semibold text-white leading-snug">{item.name}</h2>
                    </div>
                  </div>
                  <IconComponent className="w-4 h-4 text-zinc-500 shrink-0 mt-1" strokeWidth={1.5} />
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">{item.meaning}</p>
              </div>

              <div className="space-y-2 pt-3 border-t border-[#27272A]">
                <div className="p-2.5 rounded-lg bg-[#09090B] border border-[#27272A]">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 block mb-0.5">
                    Fórmula de Cálculo
                  </span>
                  <code className="text-xs font-mono text-zinc-200 break-words">
                    {item.formula}
                  </code>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#09090B]/60 border border-[#27272A] text-xs tabular-nums">
                  <span className="text-zinc-500 truncate" title={item.calculationDetail}>
                    Cálculo: <strong className="text-zinc-300 font-medium">{item.calculationDetail}</strong>
                  </span>
                  <span className="font-semibold text-white shrink-0">{item.currentValue}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
