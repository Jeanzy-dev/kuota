import React, { useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  History,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Wallet,
} from 'lucide-react';
import { apiRequest, MandatoryExpenseRecord, WorkspaceState } from '../api';
import { CURRENCY_CONFIGS, formatCurrency } from '../../shared/currency';
import {
  CycleType,
  ExpenseFrequency,
  IncomeMode,
  normalizeMandatoryExpense,
  SalaryFrequency,
} from '../../shared/financialEngine';

interface ExpensesAndCyclesViewProps {
  workspace: WorkspaceState;
  onUpdateWorkspace: (ws: WorkspaceState) => void;
}

export const ExpensesAndCyclesView: React.FC<ExpensesAndCyclesViewProps> = ({
  workspace,
  onUpdateWorkspace,
}) => {
  const { user, activeCycle, cyclesHistory, mandatoryExpenses, analysis } = workspace;
  const cur = user.currency;

  const [incomeMode, setIncomeMode] = useState<IncomeMode>(user.income_mode);
  const [cycleType, setCycleType] = useState<CycleType>(user.cycle_type);
  const [currency, setCurrency] = useState<string>(user.currency);
  const [salaryFreq, setSalaryFreq] = useState<SalaryFrequency>(user.salary_frequency);
  const [fixedSalary, setFixedSalary] = useState<string>(String(user.fixed_salary_amount || 0));
  const [currentCycleIncome, setCurrentCycleIncome] = useState<string>(
    String(activeCycle.declared_income || 0)
  );

  const [newPeriodName, setNewPeriodName] = useState<string>('');
  const [newPeriodIncome, setNewPeriodIncome] = useState<string>(
    String(activeCycle.declared_income || 0)
  );

  const [expName, setExpName] = useState('');
  const [expCategory, setExpCategory] = useState('Vivienda / Servicios');
  const [expAmount, setExpAmount] = useState('');
  const [expFreq, setExpFreq] = useState<ExpenseFrequency>('MONTHLY');
  const [expPaid, setExpPaid] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editFreq, setEditFreq] = useState<ExpenseFrequency>('MONTHLY');

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSaveIncomeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const ws = await apiRequest<WorkspaceState>('/profile', {
        method: 'PUT',
        body: JSON.stringify({
          currency,
          income_mode: incomeMode,
          cycle_type: cycleType,
          fixed_salary_amount: Number(fixedSalary) || 0,
          salary_frequency: salaryFreq,
          declared_cycle_income: Number(currentCycleIncome) || 0,
        }),
      });
      onUpdateWorkspace(ws);
      setFeedback('Configuración de ingresos y ciclo actualizada correctamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewInformalCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodIncome || Number(newPeriodIncome) <= 0) return;
    setLoading(true);
    setFeedback(null);
    try {
      const ws = await apiRequest<WorkspaceState>('/cycles', {
        method: 'POST',
        body: JSON.stringify({
          period_name:
            newPeriodName.trim() ||
            `Período #${cyclesHistory.length + 1} (${new Date().toLocaleDateString('es-CO')})`,
          declared_income: Number(newPeriodIncome),
          copy_recurring_expenses: true,
        }),
      });
      onUpdateWorkspace(ws);
      setCurrentCycleIncome(String(ws.activeCycle.declared_income));
      setNewPeriodName('');
      setFeedback('Nuevo período presupuestario iniciado.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName.trim() || !expAmount) return;
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          name: expName.trim(),
          category: expCategory,
          amount: Number(expAmount),
          frequency: expFreq,
          is_recurring: expFreq !== 'ONCE',
          is_paid: expPaid,
        }),
      });
      onUpdateWorkspace(ws);
      setExpName('');
      setExpAmount('');
      setExpPaid(false);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePaid = async (exp: MandatoryExpenseRecord) => {
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>(`/expenses/${exp.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_paid: !exp.is_paid }),
      });
      onUpdateWorkspace(ws);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (exp: MandatoryExpenseRecord) => {
    setEditingId(exp.id);
    setEditName(exp.name);
    setEditAmount(String(exp.amount));
    setEditFreq(exp.frequency);
  };

  const handleSaveEdit = async (id: string) => {
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>(`/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          amount: Number(editAmount),
          frequency: editFreq,
          is_recurring: editFreq !== 'ONCE',
        }),
      });
      onUpdateWorkspace(ws);
      setEditingId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>(`/expenses/${id}`, {
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
          Finanzas Base
        </span>
        <h1 className="text-lg sm:text-xl font-semibold text-white mt-0.5 tracking-tight">
          Ingresos, Ciclos y Gastos Fijos
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Gestiona tu esquema de ingresos, inicia nuevos períodos y lleva el control de tus pagos
          obligatorios.
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
          {feedback}
        </div>
      )}

      {/* 1. CONFIGURACIÓN DE INGRESOS Y APERTURA DE PERÍODO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <form
          onSubmit={handleSaveIncomeConfig}
          className="lg:col-span-7 bg-[#121215] border border-[#27272A] rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
              Esquema de Ingresos y Moneda
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Modalidad</label>
              <select
                data-testid="config-income-mode"
                value={incomeMode}
                onChange={(e) => setIncomeMode(e.target.value as IncomeMode)}
                className="w-full px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-xs text-white font-medium"
              >
                <option value="FIXED">Ingreso Fijo (Salario)</option>
                <option value="INFORMAL">Ingreso Variable</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Ciclo de Control</label>
              <select
                data-testid="config-cycle-type"
                value={cycleType}
                onChange={(e) => setCycleType(e.target.value as CycleType)}
                className="w-full px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-xs text-white font-medium"
              >
                <option value="MONTHLY">Mensual (30 días)</option>
                <option value="BIWEEKLY">Quincenal (15 días)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Moneda</label>
              <select
                data-testid="config-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-xs text-white font-medium"
              >
                {Object.values(CURRENCY_CONFIGS).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {incomeMode === 'FIXED' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Salario Fijo Recurrente ({cur})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  data-testid="config-fixed-salary"
                  value={fixedSalary}
                  onChange={(e) => setFixedSalary(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white font-semibold tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Frecuencia de Pago</label>
                <select
                  value={salaryFreq}
                  onChange={(e) => setSalaryFreq(e.target.value as SalaryFrequency)}
                  className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white"
                >
                  <option value="MONTHLY">Mensual</option>
                  <option value="BIWEEKLY">Quincenal</option>
                  <option value="ANNUAL">Anual Prorrateado</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="pt-1">
              <label className="block text-xs text-zinc-400 mb-1">
                Presupuesto del Período Activo ({activeCycle.period_name})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                data-testid="config-informal-income"
                value={currentCycleIncome}
                onChange={(e) => setCurrentCycleIncome(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white font-semibold tabular-nums"
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              data-testid="save-income-config-btn"
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-2 transition"
            >
              <Save className="w-4 h-4" strokeWidth={1.5} />
              Guardar Cambios
            </button>
          </div>
        </form>

        {/* Apertura de Nuevos Períodos + Historial */}
        <div className="lg:col-span-5 bg-[#121215] border border-[#27272A] rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
              Nuevo Período Presupuestario
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Cierra el ciclo actual en tu historial e inicia un nuevo período con tu presupuesto
              disponible.
            </p>

            <form onSubmit={handleOpenNewInformalCycle} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Etiqueta del Período</label>
                <input
                  type="text"
                  data-testid="new-cycle-name"
                  value={newPeriodName}
                  onChange={(e) => setNewPeriodName(e.target.value)}
                  placeholder="Ej. Quincena 2 / Nuevo Mes"
                  className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-xs text-white placeholder-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Presupuesto Disponible ({cur})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  data-testid="new-cycle-income"
                  value={newPeriodIncome}
                  onChange={(e) => setNewPeriodIncome(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white font-semibold tabular-nums"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                data-testid="open-new-cycle-btn"
                className="w-full py-2 rounded-lg bg-[#09090B] hover:bg-zinc-900 border border-[#27272A] text-zinc-200 text-xs font-medium flex items-center justify-center gap-2 transition"
              >
                <RefreshCw className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
                Iniciar Nuevo Período
              </button>
            </form>
          </div>

          <div className="pt-3 border-t border-[#27272A]">
            <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5 mb-2">
              <History className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
              Historial de Ciclos ({cyclesHistory.length})
            </span>
            <div className="max-h-28 overflow-y-auto space-y-1.5">
              {cyclesHistory.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-xs px-3 py-1.5 rounded-md bg-[#09090B] border border-[#27272A] tabular-nums"
                >
                  <span className="text-zinc-300 truncate max-w-[160px]">{c.period_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {formatCurrency(c.declared_income, cur)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        c.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-[#121215] text-zinc-500 border-[#27272A]'
                      }`}
                    >
                      {c.status === 'ACTIVE' ? 'Activo' : 'Cerrado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. GESTIÓN DE GASTOS OBLIGATORIOS */}
      <div className="bg-[#121215] border border-[#27272A] rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
              Gastos Fijos del Ciclo ({mandatoryExpenses.length})
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Cálculo automático a base diaria y al ciclo ({analysis.cycleDays} días). Marca cada
              compromiso como <strong>Pagado</strong> o <strong>Pendiente</strong>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs tabular-nums">
            <div className="px-3 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A]">
              <span className="text-zinc-500">Pagado: </span>
              <strong className="text-white font-semibold">
                {formatCurrency(analysis.paidMandatoryExpenses, cur)}
              </strong>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A]">
              <span className="text-zinc-500">Pendiente: </span>
              <strong className="text-white font-semibold">
                {formatCurrency(analysis.pendingMandatoryExpenses, cur)}
              </strong>
            </div>
          </div>
        </div>

        {/* Formulario para agregar nuevo gasto */}
        <form
          onSubmit={handleCreateExpense}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-lg bg-[#09090B] border border-[#27272A]"
        >
          <div className="sm:col-span-4">
            <label className="block text-[11px] text-zinc-500 mb-1">Concepto del Gasto</label>
            <input
              type="text"
              required
              data-testid="expense-input-name"
              value={expName}
              onChange={(e) => setExpName(e.target.value)}
              placeholder="Ej. Arriendo, Servicios, Transporte..."
              className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-md text-xs text-white placeholder-zinc-600"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-[11px] text-zinc-500 mb-1">Monto ({cur})</label>
            <input
              type="number"
              required
              min="1"
              step="any"
              data-testid="expense-input-amount"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="500000"
              className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-md text-xs text-white font-semibold tabular-nums placeholder-zinc-600"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-[11px] text-zinc-500 mb-1">Frecuencia</label>
            <select
              data-testid="expense-input-frequency"
              value={expFreq}
              onChange={(e) => setExpFreq(e.target.value as ExpenseFrequency)}
              className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-md text-xs text-white"
            >
              <option value="MONTHLY">Mensual</option>
              <option value="BIWEEKLY">Quincenal</option>
              <option value="ONCE">Único en el período</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={loading}
              data-testid="expense-submit-btn"
              className="w-full py-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" strokeWidth={1.5} />
              Agregar
            </button>
          </div>
        </form>

        {/* Vista de Tarjetas en Móvil */}
        <div className="md:hidden space-y-2.5">
          {mandatoryExpenses.map((exp) => {
            const norm = normalizeMandatoryExpense(exp.amount, exp.frequency, user.cycle_type);
            const isEditing = editingId === exp.id;
            return (
              <div
                key={exp.id}
                className="p-4 rounded-lg bg-[#09090B] border border-[#27272A] space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-2.5 py-1 bg-[#121215] border border-[#27272A] rounded text-xs text-white mb-1"
                      />
                    ) : (
                      <h4 className="text-sm font-medium text-white">{exp.name}</h4>
                    )}
                    <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-[#121215] border border-[#27272A] text-zinc-400 mt-0.5">
                      {exp.frequency === 'MONTHLY'
                        ? 'Mensual'
                        : exp.frequency === 'BIWEEKLY'
                          ? 'Quincenal'
                          : 'Único'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTogglePaid(exp)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 border transition ${
                      exp.is_paid
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-[#121215] text-zinc-400 border-[#27272A]'
                    }`}
                  >
                    {exp.is_paid ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                        Pagado
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
                        Pendiente
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#27272A] tabular-nums">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Monto Original</span>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-full px-2 py-1 bg-[#121215] border border-[#27272A] rounded text-xs text-white mt-0.5"
                      />
                    ) : (
                      <strong className="text-white font-semibold">{formatCurrency(exp.amount, cur)}</strong>
                    )}
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">
                      Impacto Ciclo ({analysis.cycleDays}d)
                    </span>
                    <strong className="text-white font-semibold">
                      {formatCurrency(norm.cycleAmount.toNumber(), cur)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#27272A] text-xs tabular-nums">
                  <span className="text-zinc-500">
                    Base diaria: {formatCurrency(norm.dailyAmount.toNumber(), cur)}/día
                  </span>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(exp.id)}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white font-medium"
                      >
                        Guardar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditing(exp)}
                        className="p-1.5 text-zinc-500 hover:text-white"
                      >
                        <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="p-1.5 text-zinc-500 hover:text-zinc-200"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabla en Escritorio */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272A] text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="py-3 px-3 font-medium">Concepto</th>
                <th className="py-3 px-3 font-medium">Monto Original</th>
                <th className="py-3 px-3 font-medium">Frecuencia</th>
                <th className="py-3 px-3 font-medium">Base Diaria</th>
                <th className="py-3 px-3 font-medium">Impacto en Ciclo ({analysis.cycleDays}d)</th>
                <th className="py-3 px-3 font-medium">Estado</th>
                <th className="py-3 px-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A] text-xs tabular-nums">
              {mandatoryExpenses.map((exp) => {
                const norm = normalizeMandatoryExpense(exp.amount, exp.frequency, user.cycle_type);
                const isEditing = editingId === exp.id;

                return (
                  <tr key={exp.id} className="hover:bg-[#09090B]/60">
                    <td className="py-3 px-3 font-medium text-white">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2.5 py-1 bg-[#09090B] border border-[#27272A] rounded text-xs text-white"
                        />
                      ) : (
                        exp.name
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-28 px-2.5 py-1 bg-[#09090B] border border-[#27272A] rounded text-xs text-white"
                        />
                      ) : (
                        formatCurrency(exp.amount, cur)
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <select
                          value={editFreq}
                          onChange={(e) => setEditFreq(e.target.value as ExpenseFrequency)}
                          className="px-2 py-1 bg-[#09090B] border border-[#27272A] rounded text-xs text-white"
                        >
                          <option value="MONTHLY">Mensual</option>
                          <option value="BIWEEKLY">Quincenal</option>
                          <option value="ONCE">Único</option>
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-[#09090B] border border-[#27272A] text-zinc-400">
                          {exp.frequency === 'MONTHLY'
                            ? 'Mensual'
                            : exp.frequency === 'BIWEEKLY'
                              ? 'Quincenal'
                              : 'Único en el período'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-zinc-400">
                      {formatCurrency(norm.dailyAmount.toNumber(), cur)}/día
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">
                      {formatCurrency(norm.cycleAmount.toNumber(), cur)}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => handleTogglePaid(exp)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 border transition ${
                          exp.is_paid
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-[#09090B] text-zinc-400 border-[#27272A]'
                        }`}
                      >
                        {exp.is_paid ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                            Pagado
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
                            Pendiente
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(exp.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white font-medium"
                          >
                            Guardar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing(exp)}
                            className="p-1.5 text-zinc-500 hover:text-white"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-200"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
