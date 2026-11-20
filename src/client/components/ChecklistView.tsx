import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  PlusCircle,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest, WorkspaceState } from '../api';
import { formatCurrency } from '../../shared/currency';
import { ChecklistStatus } from '../../shared/financialEngine';

interface ChecklistViewProps {
  workspace: WorkspaceState;
  onUpdateWorkspace: (ws: WorkspaceState) => void;
}

export const ChecklistView: React.FC<ChecklistViewProps> = ({
  workspace,
  onUpdateWorkspace,
}) => {
  const { user, savingsGoals, trackingChecklists, analysis } = workspace;
  const cur = user.currency;

  const primaryGoal =
    savingsGoals.find((g) => g.is_primary) || savingsGoals[0] || null;
  const [selectedGoalId, setSelectedGoalId] = useState<string>(primaryGoal?.id || '');
  const [periodType, setPeriodType] = useState<'WEEKLY' | 'WEEKEND' | 'CYCLE_CLOSE'>('WEEKLY');
  const [periodLabel, setPeriodLabel] = useState<string>(
    `Semana ${trackingChecklists.length + 1} — Control`
  );
  const [selectedAction, setSelectedAction] = useState<ChecklistStatus>('ON_TRACK');
  const [extraOrOverspentAmount, setExtraOrOverspentAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeGoalProj =
    analysis.allGoalsProjections.find((g) => g.goalId === selectedGoalId) ||
    analysis.primaryGoalProjection;

  const getSuggestedBudgetLimit = () => {
    if (periodType === 'WEEKEND') return analysis.limits.weekendLimit;
    if (periodType === 'CYCLE_CLOSE') return analysis.freeSpendingBudgetCycle;
    return analysis.limits.weeklyLimit;
  };

  const handlePeriodTypeChange = (newType: 'WEEKLY' | 'WEEKEND' | 'CYCLE_CLOSE') => {
    setPeriodType(newType);
    const nextIdx = trackingChecklists.length + 1;
    if (newType === 'WEEKLY') {
      setPeriodLabel(`Semana ${nextIdx} — Control Semanal`);
    } else if (newType === 'WEEKEND') {
      setPeriodLabel(`Fin de Semana ${nextIdx}`);
    } else {
      setPeriodLabel(`Cierre de Ciclo #${nextIdx}`);
    }
  };

  const previewImpactDays = () => {
    if (!activeGoalProj || activeGoalProj.dailyRequiredSavings <= 0) return 0;
    if (selectedAction === 'ON_TRACK') return 0;
    const amt = Math.abs(Number(extraOrOverspentAmount) || 0);
    const days = amt / activeGoalProj.dailyRequiredSavings;
    return selectedAction === 'SAVED_EXTRA'
      ? Number(days.toFixed(2))
      : Number((-days).toFixed(2));
  };

  const handleRecordChecklist = async (
    e?: React.FormEvent,
    overrideStatus?: ChecklistStatus
  ) => {
    if (e) e.preventDefault();
    const statusToUse = overrideStatus || selectedAction;

    if (!activeGoalProj) {
      setError('Primero debes crear una meta de ahorro activa.');
      return;
    }

    if (
      (statusToUse === 'OVER_BUDGET' || statusToUse === 'SAVED_EXTRA') &&
      (!extraOrOverspentAmount || Number(extraOrOverspentAmount) <= 0)
    ) {
      setError(
        statusToUse === 'OVER_BUDGET'
          ? 'Por favor digita el monto excedido sobre tu límite libre.'
          : 'Por favor digita el monto que ahorraste extra o gastaste de menos.'
      );
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>('/checklists', {
        method: 'POST',
        body: JSON.stringify({
          goal_id: activeGoalProj.goalId,
          period_label:
            periodLabel.trim() || `Registro #${trackingChecklists.length + 1}`,
          period_type: periodType,
          status: statusToUse,
          budget_limit: getSuggestedBudgetLimit(),
          extra_or_overspent_amount:
            statusToUse === 'ON_TRACK' ? 0 : Number(extraOrOverspentAmount),
          notes: notes.trim() || undefined,
        }),
      });
      onUpdateWorkspace(ws);
      setExtraOrOverspentAmount('');
      setNotes('');
      setPeriodLabel(`Semana ${ws.trackingChecklists.length + 1} — Control`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>(`/checklists/${id}`, {
        method: 'DELETE',
      });
      onUpdateWorkspace(ws);
    } finally {
      setLoading(false);
    }
  };

  const chronological = [...trackingChecklists].reverse();
  let runningDeltaDays = 0;
  const timelineChartData = chronological.map((item, idx) => {
    runningDeltaDays = Number((runningDeltaDays + Number(item.days_impact)).toFixed(2));
    return {
      name: item.period_label.slice(0, 16),
      impactoPeriodo: Number(item.days_impact),
      acumuladoDias: runningDeltaDays,
      indice: idx + 1,
    };
  });

  const liveDays = previewImpactDays();

  return (
    <div className="space-y-6">
      {/* Encabezado limpio */}
      <div className="bg-[#121215] border border-[#27272A] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Seguimiento de Presupuesto
          </span>
          <h1 className="text-lg sm:text-xl font-semibold text-white mt-0.5 tracking-tight">
            Control de Gastos y Ritmo de Meta
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Registra cómo te fue en la semana o fin de semana para actualizar tu fecha estimada al
            instante.
          </p>
        </div>

        {activeGoalProj && (
          <div
            data-testid="checklist-header-delta-badge"
            className={`px-3.5 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 self-start lg:self-auto shrink-0 tabular-nums ${
              activeGoalProj.variationInDays > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : activeGoalProj.variationInDays < 0
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-[#09090B] border-[#27272A] text-zinc-300'
            }`}
          >
            <span className="text-zinc-400">Balance (Δt):</span>
            <span className="font-semibold text-white">{activeGoalProj.temporalBreakdown.badgeText}</span>
          </div>
        )}
      </div>

      {/* PANEL DE MARCACIÓN RÁPIDA */}
      <div className="bg-[#121215] border border-[#27272A] rounded-xl p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Meta Asociada
            </label>
            <select
              data-testid="checklist-goal-select"
              value={selectedGoalId}
              onChange={(e) => setSelectedGoalId(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white"
            >
              {savingsGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.product_name} ({formatCurrency(g.target_amount, cur)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Período a Evaluar
            </label>
            <select
              data-testid="checklist-period-type"
              value={periodType}
              onChange={(e) => handlePeriodTypeChange(e.target.value as any)}
              className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white"
            >
              <option value="WEEKLY">
                Semanal (Tope: {formatCurrency(analysis.limits.weeklyLimit, cur)})
              </option>
              <option value="WEEKEND">
                Fin de Semana (Tope: {formatCurrency(analysis.limits.weekendLimit, cur)})
              </option>
              <option value="CYCLE_CLOSE">
                Cierre de Ciclo (Tope: {formatCurrency(analysis.freeSpendingBudgetCycle, cur)})
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Nombre del Registro
            </label>
            <input
              type="text"
              data-testid="checklist-period-label"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="Ej. Semana 1"
              className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white"
            />
          </div>
        </div>

        {/* 3 BOTONES RÁPIDOS SOBRIOS */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2.5">
            ¿Cómo estuvo tu gasto en este período?
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              data-testid="btn-status-on-track"
              onClick={() => {
                setSelectedAction('ON_TRACK');
                setError(null);
              }}
              className={`p-4 rounded-lg border text-left transition flex flex-col justify-between ${
                selectedAction === 'ON_TRACK'
                  ? 'bg-[#09090B] border-emerald-500 text-white'
                  : 'bg-[#09090B] border-[#27272A] text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-white">Cumplí el presupuesto</span>
                <CheckCircle2 className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
              </div>
              <p className="text-xs text-zinc-500 mt-2 tabular-nums">
                Me mantuve dentro del tope sugerido ({formatCurrency(getSuggestedBudgetLimit(), cur)}). Sin variación de días.
              </p>
            </button>

            <button
              type="button"
              data-testid="btn-status-saved-extra"
              onClick={() => {
                setSelectedAction('SAVED_EXTRA');
                setError(null);
              }}
              className={`p-4 rounded-lg border text-left transition flex flex-col justify-between ${
                selectedAction === 'SAVED_EXTRA'
                  ? 'bg-[#09090B] border-emerald-500 text-white'
                  : 'bg-[#09090B] border-[#27272A] text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-white">Ahorré extra</span>
                <TrendingUp className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Gasté menos del tope o aboné dinero adicional. Adelanta la fecha de tu meta.
              </p>
            </button>

            <button
              type="button"
              data-testid="btn-status-over-budget"
              onClick={() => {
                setSelectedAction('OVER_BUDGET');
                setError(null);
              }}
              className={`p-4 rounded-lg border text-left transition flex flex-col justify-between ${
                selectedAction === 'OVER_BUDGET'
                  ? 'bg-[#09090B] border-rose-500 text-white'
                  : 'bg-[#09090B] border-[#27272A] text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-white">Gasté de más</span>
                <TrendingDown className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Superé el límite libre sugerido. Calcula cuántos días se desplaza tu meta.
              </p>
            </button>
          </div>
        </div>

        {/* Input dinámico cuando selecciona "Gasté de más" o "Ahorré extra" */}
        {selectedAction !== 'ON_TRACK' && (
          <div
            data-testid="checklist-dynamic-amount-box"
            className="p-4 rounded-lg bg-[#09090B] border border-[#27272A]"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  {selectedAction === 'OVER_BUDGET'
                    ? `Monto excedido sobre tu límite (${cur}):`
                    : `Monto ahorrado adicional (${cur}):`}
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  data-testid="checklist-deviation-input"
                  value={extraOrOverspentAmount}
                  onChange={(e) => setExtraOrOverspentAmount(e.target.value)}
                  placeholder={selectedAction === 'OVER_BUDGET' ? 'Ej. 150000' : 'Ej. 100000'}
                  className="w-full px-3.5 py-2 bg-[#121215] border border-[#27272A] rounded-lg text-sm text-white font-semibold tabular-nums focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-[#121215] border border-[#27272A] text-xs tabular-nums">
                <span className="text-zinc-500 block">
                  Impacto en tu Meta (ADR: {formatCurrency(activeGoalProj?.dailyRequiredSavings || 0, cur)}/día):
                </span>
                <div
                  data-testid="checklist-live-impact-preview"
                  className={`text-sm font-semibold mt-1 ${
                    liveDays > 0
                      ? 'text-emerald-400'
                      : liveDays < 0
                        ? 'text-rose-400'
                        : 'text-white'
                  }`}
                >
                  {liveDays > 0
                    ? `+${liveDays} días de adelanto (${(liveDays / 7).toFixed(2)} semanas)`
                    : liveDays < 0
                      ? `${liveDays} días de atraso (${(Math.abs(liveDays) / 7).toFixed(2)} semanas)`
                      : '0 días de variación'}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#27272A]">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Nota opcional (ej. Salida fin de semana, ahorro en compras...)"
            className="flex-1 px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-xs text-white placeholder-zinc-600"
          />

          <button
            type="button"
            disabled={loading}
            data-testid="checklist-submit-btn"
            onClick={() => handleRecordChecklist()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
            {loading ? 'Guardando...' : 'Guardar Registro'}
          </button>
        </div>
      </div>

      {/* GRÁFICA DE EVOLUCIÓN DE ADELANTO / ATRASO ACUMULADO */}
      {timelineChartData.length > 0 && (
        <div className="bg-[#121215] border border-[#27272A] rounded-xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Evolución de Días Ganados o Perdidos (Δt)
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            Tendencia acumulada de adelanto (+) o atraso (-) frente a tu fecha inicial
          </p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                <XAxis dataKey="name" stroke="#71717A" fontSize={11} />
                <YAxis stroke="#71717A" fontSize={11} />
                <Tooltip
                  formatter={(val: any) => [`${val} días`, 'Variación Acumulada']}
                  contentStyle={{
                    backgroundColor: '#121215',
                    borderColor: '#27272A',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#FAFAFA',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="acumuladoDias"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* LISTA CRONOLÓGICA DE REGISTROS */}
      <div className="bg-[#121215] border border-[#27272A] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">
          Historial de Registros ({trackingChecklists.length})
        </h3>

        {trackingChecklists.length === 0 ? (
          <div className="p-8 text-center rounded-lg border border-dashed border-[#27272A] text-zinc-500 text-xs">
            Aún no hay registros de seguimiento. Marca tu primer período arriba.
          </div>
        ) : (
          <div className="space-y-2.5">
            {trackingChecklists.map((item) => {
              const isOver = item.status === 'OVER_BUDGET';
              const isSaved = item.status === 'SAVED_EXTRA';
              return (
                <div
                  key={item.id}
                  data-testid="checklist-history-item"
                  className="p-3.5 rounded-lg bg-[#09090B] border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-xs sm:text-sm text-white">
                        {item.period_label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                          isSaved
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : isOver
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-[#121215] text-zinc-300 border-[#27272A]'
                        }`}
                      >
                        {isSaved
                          ? 'Ahorré extra'
                          : isOver
                            ? 'Gasté de más'
                            : 'Cumplí el presupuesto'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 flex flex-wrap gap-4 tabular-nums">
                      <span>
                        Tope: <strong className="text-zinc-300">{formatCurrency(item.budget_limit, cur)}</strong>
                      </span>
                      <span>
                        Gasto Real: <strong className="text-white">{formatCurrency(item.actual_spent, cur)}</strong>
                      </span>
                      {item.notes && <span className="text-zinc-500">“{item.notes}”</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 tabular-nums">
                    <div
                      className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 border ${
                        item.days_impact > 0
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : item.days_impact < 0
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-[#121215] text-zinc-400 border-[#27272A]'
                      }`}
                    >
                      {item.days_impact > 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                      ) : item.days_impact < 0 ? (
                        <ArrowDownRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                      ) : null}
                      <span>
                        {item.days_impact > 0
                          ? `+${item.days_impact} días adelanto`
                          : item.days_impact < 0
                            ? `${item.days_impact} días atraso`
                            : '0 días (En meta)'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteChecklist(item.id)}
                      className="p-1.5 text-zinc-500 hover:text-zinc-200 transition"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
