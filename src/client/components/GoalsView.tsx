import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { apiRequest, WorkspaceState } from '../api';
import { formatCurrency } from '../../shared/currency';
import {
  calculateTotalGoalDays,
  DurationUnit,
} from '../../shared/financialEngine';

interface GoalsViewProps {
  workspace: WorkspaceState;
  onUpdateWorkspace: (ws: WorkspaceState) => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  workspace,
  onUpdateWorkspace,
}) => {
  const { user, savingsGoals, analysis } = workspace;
  const cur = user.currency;

  const [productName, setProductName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('0');
  const [durationValue, setDurationValue] = useState('3');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('MONTHS');
  const [allocationPct, setAllocationPct] = useState('100');
  const [isPrimary, setIsPrimary] = useState(true);
  const [loading, setLoading] = useState(false);

  const previewDTM = calculateTotalGoalDays(
    Number(durationValue) || 1,
    durationUnit
  ).toNumber();
  const previewPrice = Number(targetAmount) || 0;
  const previewInitialSaved = Math.max(0, Number(savedAmount) || 0);
  const previewNetToFinance = Math.max(0, previewPrice - previewInitialSaved);
  const previewADR = previewDTM > 0 ? previewNetToFinance / previewDTM : 0;
  const previewCycleRequired = previewADR * analysis.cycleDays;
  const previewAllocation = Math.max(1, Math.min(100, Number(allocationPct) || 100));
  const previewAllocatedIND = (analysis.netAvailableIncome * previewAllocation) / 100;
  const previewViable =
    analysis.netAvailableIncome > 0 &&
    previewCycleRequired <= previewAllocatedIND;
  const minRealisticDays =
    previewAllocatedIND > 0
      ? Math.max(
          1,
          Math.ceil(previewNetToFinance / (previewAllocatedIND / analysis.cycleDays))
        )
      : previewDTM;

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !targetAmount) return;
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>('/goals', {
        method: 'POST',
        body: JSON.stringify({
          product_name: productName.trim(),
          target_amount: Number(targetAmount),
          saved_amount: Number(savedAmount || 0),
          duration_value: Number(durationValue),
          duration_unit: durationUnit,
          allocation_pct: Number(allocationPct || 100),
          is_primary: isPrimary,
        }),
      });
      onUpdateWorkspace(ws);
      setProductName('');
      setTargetAmount('');
      setSavedAmount('0');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimary = async (goalId: string) => {
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>(`/goals/${goalId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_primary: true }),
      });
      onUpdateWorkspace(ws);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdjustDuration = async (
    goalId: string,
    newDays: number
  ) => {
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>(`/goals/${goalId}`, {
        method: 'PUT',
        body: JSON.stringify({
          duration_value: newDays,
          duration_unit: 'DAYS',
        }),
      });
      onUpdateWorkspace(ws);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>(`/goals/${goalId}`, {
        method: 'DELETE',
      });
      onUpdateWorkspace(ws);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado limpio */}
      <div className="bg-[#121215] border border-[#27272A] rounded-xl p-5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Objetivos Financieros
        </span>
        <h1 className="text-lg sm:text-xl font-semibold text-white mt-0.5 tracking-tight">
          Metas de Ahorro y Proyección
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Define tus próximos objetivos de compra y simula el plazo ideal según tu capacidad de
          ahorro disponible.
        </p>
      </div>

      {/* Formulario de Creación de Meta */}
      <form
        onSubmit={handleCreateGoal}
        className="bg-[#121215] border border-[#27272A] rounded-xl p-5 sm:p-6 space-y-5"
      >
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
          Nueva Meta de Ahorro
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-400 mb-1.5">
              Objetivo o Producto
            </label>
            <input
              type="text"
              required
              data-testid="goal-input-name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder='Ej. "Portátil para desarrollo", "Moto", "Viaje"'
              className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white placeholder-zinc-600"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Valor Objetivo ({cur})
            </label>
            <input
              type="number"
              required
              min="1"
              step="any"
              data-testid="goal-input-price"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="3500000"
              className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white font-semibold tabular-nums placeholder-zinc-600"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Ahorro Inicial ({cur})
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={savedAmount}
              onChange={(e) => setSavedAmount(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Tiempo Previsto
            </label>
            <input
              type="number"
              required
              min="1"
              data-testid="goal-input-duration-value"
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white font-semibold tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Unidad de Tiempo
            </label>
            <select
              data-testid="goal-input-duration-unit"
              value={durationUnit}
              onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
              className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white"
            >
              <option value="DAYS">Días</option>
              <option value="WEEKS">Semanas</option>
              <option value="MONTHS">Meses</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Asignación de Ahorro (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="10"
                max="100"
                value={allocationPct}
                onChange={(e) => setAllocationPct(e.target.value)}
                className="w-24 px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white tabular-nums"
              />
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                Meta Principal
              </label>
            </div>
          </div>
        </div>

        {/* Previsualizador en vivo */}
        {previewPrice > 0 && (
          <div
            className={`p-3.5 rounded-lg border text-xs tabular-nums ${
              previewViable
                ? 'bg-[#09090B] border-[#27272A] text-zinc-300'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 font-medium">
              <span>
                Plazo (DTM): {previewDTM} días · Por financiar:{' '}
                <strong className="text-white">{formatCurrency(previewNetToFinance, cur)}</strong> ·
                Cuota diaria (ADR):{' '}
                <strong className="text-white">{formatCurrency(previewADR, cur)}/día</strong> · Por
                ciclo: <strong className="text-white">{formatCurrency(previewCycleRequired, cur)}</strong>
              </span>
              <span>
                Disponible (IND):{' '}
                <strong className="text-white">
                  {formatCurrency(analysis.netAvailableIncome, cur)}
                </strong>
              </span>
            </div>
            {!previewViable && (
              <p className="mt-2 text-amber-300 font-medium">
                El ahorro requerido por ciclo supera tu disponible. El plazo mínimo realista es de{' '}
                {minRealisticDays} días ({(minRealisticDays / 7).toFixed(1)} semanas /{' '}
                {(minRealisticDays / 30).toFixed(1)} meses).
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            data-testid="goal-submit-btn"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            Crear Meta
          </button>
        </div>
      </form>

      {/* Listado de Metas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {analysis.allGoalsProjections.map((proj) => {
          const rawGoal = savingsGoals.find((g) => g.id === proj.goalId);
          return (
            <div
              key={proj.goalId}
              className="p-5 rounded-xl bg-[#121215] border border-[#27272A] space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{proj.productName}</h3>
                    {rawGoal?.is_primary && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Principal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                    Objetivo:{' '}
                    <strong className="text-white font-semibold">
                      {formatCurrency(proj.targetAmount, cur)}
                    </strong>{' '}
                    · Plazo (DTM): <strong className="text-zinc-300">{proj.totalGoalDays} días</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!rawGoal?.is_primary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(proj.goalId)}
                      className="px-2.5 py-1 rounded-md bg-[#09090B] hover:bg-zinc-900 border border-[#27272A] text-xs text-zinc-300 font-medium"
                    >
                      Principal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteGoal(proj.goalId)}
                    className="p-1.5 text-zinc-500 hover:text-zinc-200"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs tabular-nums">
                <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A]">
                  <span className="text-zinc-500 block text-[11px]">Cuota Diaria (ADR)</span>
                  <strong className="text-white font-semibold text-sm">
                    {formatCurrency(proj.dailyRequiredSavings, cur)}
                  </strong>
                </div>
                <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A]">
                  <span className="text-zinc-500 block text-[11px]">Acumulado (ARA)</span>
                  <strong className="text-white font-semibold text-sm">
                    {formatCurrency(proj.accumulatedRealSavings, cur)}
                  </strong>
                </div>
                <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A] col-span-2 sm:col-span-1">
                  <span className="text-zinc-500 block text-[11px]">Balance (Δt)</span>
                  <strong
                    className={`text-sm font-semibold ${
                      proj.variationInDays > 0
                        ? 'text-emerald-400'
                        : proj.variationInDays < 0
                          ? 'text-rose-400'
                          : 'text-white'
                    }`}
                  >
                    {proj.temporalBreakdown.badgeText}
                  </strong>
                </div>
              </div>

              {proj.viabilityAlert.triggered ? (
                <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 tabular-nums">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>
                      Plazo ajustado recomendado:{' '}
                      <strong>
                        {proj.viabilityAlert.minRealisticDays} días (
                        {proj.viabilityAlert.minRealisticMonths} meses)
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAdjustDuration(
                        proj.goalId,
                        proj.viabilityAlert.minRealisticDays + 15
                      )
                    }
                    className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium shrink-0"
                  >
                    Aplicar Plazo
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <CheckCircle2 className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
                  <span>Meta viable dentro de tu presupuesto disponible.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
