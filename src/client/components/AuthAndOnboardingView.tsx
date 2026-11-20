import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  CreditCard,
  Lock,
  Mail,
  Plus,
  Target,
  Trash2,
  User,
  Wallet,
} from 'lucide-react';
import { apiRequest, WorkspaceState } from '../api';
import { CURRENCY_CONFIGS, formatCurrency } from '../../shared/currency';
import {
  CycleType,
  DurationUnit,
  ExpenseFrequency,
  IncomeMode,
  SalaryFrequency,
} from '../../shared/financialEngine';

interface AuthAndOnboardingProps {
  workspace: WorkspaceState | null;
  onUpdateWorkspace: (ws: WorkspaceState) => void;
}

export const AuthAndOnboardingView: React.FC<AuthAndOnboardingProps> = ({
  workspace,
  onUpdateWorkspace,
}) => {
  const [authTab, setAuthTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<'COP' | 'USD' | 'EUR' | 'MXN'>('COP');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado del Onboarding de 3 pasos
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [incomeMode, setIncomeMode] = useState<IncomeMode>(
    workspace?.user.income_mode || 'FIXED'
  );
  const [cycleType, setCycleType] = useState<CycleType>(
    workspace?.user.cycle_type || 'MONTHLY'
  );
  const [salaryFrequency, setSalaryFrequency] = useState<SalaryFrequency>(
    workspace?.user.salary_frequency || 'MONTHLY'
  );
  const [incomeAmount, setIncomeAmount] = useState<string>(
    workspace
      ? String(
          workspace.user.income_mode === 'FIXED'
            ? workspace.user.fixed_salary_amount || 3500000
            : workspace.activeCycle.declared_income || 3500000
        )
      : '3500000'
  );
  const [selectedCurrency, setSelectedCurrency] = useState<'COP' | 'USD' | 'EUR' | 'MXN'>(
    (workspace?.user.currency as any) || 'COP'
  );

  // Paso 2: Gastos Obligatorios
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expFreq, setExpFreq] = useState<ExpenseFrequency>('MONTHLY');
  const [expPaid, setExpPaid] = useState(false);

  // Paso 3: Crear Primera Meta
  const [goalName, setGoalName] = useState('Portátil para desarrollo');
  const [goalPrice, setGoalPrice] = useState('4500000');
  const [goalDurationVal, setGoalDurationVal] = useState('4');
  const [goalDurationUnit, setGoalDurationUnit] = useState<DurationUnit>('MONTHS');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onUpdateWorkspace(ws);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'demo@kuota.app', password: 'Demo123456!' }),
      });
      onUpdateWorkspace(ws);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name: name || 'Usuario',
          currency,
          income_mode: 'FIXED',
          cycle_type: 'MONTHLY',
        }),
      });
      setSelectedCurrency(currency);
      setIncomeAmount(currency === 'USD' || currency === 'EUR' ? '2500' : '3500000');
      setGoalPrice(currency === 'USD' || currency === 'EUR' ? '1800' : '4500000');
      onUpdateWorkspace(ws);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Si aún no está autenticado -> Formulario de Login / Registro minimalista (Zinc / Carbono)
  if (!workspace) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm">
          {/* Branding sobrio sin contenedores de colores */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center gap-2 mb-2">
              <Wallet className="w-5 h-5 text-zinc-500" strokeWidth={1.5} />
              <h1 className="text-xl font-semibold tracking-tight text-white">Kuota</h1>
            </div>
            <p className="text-xs text-zinc-500">
              Planificación financiera y proyección de metas
            </p>
          </div>

          <div className="bg-[#121215] border border-[#27272A] rounded-xl p-6">
            <div className="flex rounded-lg bg-[#09090B] p-1 border border-[#27272A] mb-6">
              <button
                type="button"
                data-testid="tab-login"
                onClick={() => {
                  setAuthTab('LOGIN');
                  setError(null);
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition ${
                  authTab === 'LOGIN'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                data-testid="tab-register"
                onClick={() => {
                  setAuthTab('REGISTER');
                  setError(null);
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition ${
                  authTab === 'REGISTER'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Crear Cuenta
              </button>
            </div>

            {error && (
              <div
                data-testid="auth-error"
                className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs"
              >
                {error}
              </div>
            )}

            {authTab === 'LOGIN' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-zinc-500 absolute left-3.5 top-2.5"
                      strokeWidth={1.5}
                    />
                    <input
                      type="email"
                      required
                      data-testid="login-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      className="w-full pl-10 pr-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-4 h-4 text-zinc-500 absolute left-3.5 top-2.5"
                      strokeWidth={1.5}
                    />
                    <input
                      type="password"
                      required
                      data-testid="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  data-testid="login-submit"
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                </button>

                <div className="pt-4 border-t border-[#27272A]">
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={loading}
                    data-testid="demo-login-btn"
                    className="w-full py-2 px-3 rounded-lg bg-[#09090B] hover:bg-zinc-900 border border-[#27272A] text-zinc-300 text-xs font-medium transition flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
                    Probar con Cuenta Demo
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Nombre
                  </label>
                  <div className="relative">
                    <User
                      className="w-4 h-4 text-zinc-500 absolute left-3.5 top-2.5"
                      strokeWidth={1.5}
                    />
                    <input
                      type="text"
                      required
                      data-testid="register-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej. Valentina Gómez"
                      className="w-full pl-10 pr-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-zinc-500 absolute left-3.5 top-2.5"
                      strokeWidth={1.5}
                    />
                    <input
                      type="email"
                      required
                      data-testid="register-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      className="w-full pl-10 pr-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-4 h-4 text-zinc-500 absolute left-3.5 top-2.5"
                      strokeWidth={1.5}
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      data-testid="register-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-10 pr-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Moneda principal
                  </label>
                  <div className="relative">
                    <Coins
                      className="w-4 h-4 text-zinc-500 absolute left-3.5 top-2.5"
                      strokeWidth={1.5}
                    />
                    <select
                      data-testid="register-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as any)}
                      className="w-full pl-10 pr-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                    >
                      {Object.values(CURRENCY_CONFIGS).map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  data-testid="register-submit"
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Creando cuenta...' : 'Continuar'}
                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ASISTENTE INICIAL DE 3 PASOS
  // ============================================================================

  const handleSaveStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const numIncome = Number(incomeAmount) || 0;
      const ws = await apiRequest<WorkspaceState>('/profile', {
        method: 'PUT',
        body: JSON.stringify({
          currency: selectedCurrency,
          income_mode: incomeMode,
          cycle_type: cycleType,
          fixed_salary_amount: incomeMode === 'FIXED' ? numIncome : 0,
          salary_frequency: salaryFrequency,
          declared_cycle_income: numIncome,
        }),
      });
      onUpdateWorkspace(ws);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOnboardingExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName.trim() || !expAmount) return;
    setError(null);
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          name: expName.trim(),
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPresetExpense = async (
    presetName: string,
    presetAmount: number,
    freq: ExpenseFrequency = 'MONTHLY'
  ) => {
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          name: presetName,
          amount: presetAmount,
          frequency: freq,
          is_recurring: true,
          is_paid: false,
        }),
      });
      onUpdateWorkspace(ws);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setLoading(true);
    try {
      const ws = await apiRequest<WorkspaceState>(`/expenses/${id}`, { method: 'DELETE' });
      onUpdateWorkspace(ws);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiRequest<WorkspaceState>('/goals', {
        method: 'POST',
        body: JSON.stringify({
          product_name: goalName.trim(),
          target_amount: Number(goalPrice),
          duration_value: Number(goalDurationVal),
          duration_unit: goalDurationUnit,
          is_primary: true,
          allocation_pct: 100,
        }),
      });

      const finalWs = await apiRequest<WorkspaceState>('/profile', {
        method: 'PUT',
        body: JSON.stringify({ onboarding_done: true }),
      });
      onUpdateWorkspace(finalWs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cur = workspace.user.currency;

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 py-6 sm:py-10 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-[#121215] border border-[#27272A] rounded-xl p-5 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#27272A]">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Configuración Inicial
            </span>
            <h2 className="text-lg sm:text-xl font-semibold text-white mt-0.5">
              Personaliza tu Plan Financiero
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                  step === s
                    ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-400'
                    : step > s
                      ? 'bg-[#09090B] border-[#27272A] text-emerald-500'
                      : 'bg-[#09090B] border-[#27272A] text-zinc-500'
                }`}
              >
                {step > s ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
                ) : (
                  <span>Paso {s}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
            {error}
          </div>
        )}

        {/* PASO 1 */}
        {step === 1 && (
          <form onSubmit={handleSaveStep1} className="mt-6 space-y-5">
            <div>
              <h3 className="text-sm sm:text-base font-medium text-white">
                1. Esquema de Ingresos y Frecuencia
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Elige cómo recibes tus ingresos para adaptar los cálculos a tu ritmo laboral.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="mode-fixed-btn"
                onClick={() => setIncomeMode('FIXED')}
                className={`p-4 rounded-lg border text-left transition ${
                  incomeMode === 'FIXED'
                    ? 'bg-[#09090B] border-emerald-500 text-white'
                    : 'bg-[#09090B] border-[#27272A] text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm">Ingreso Fijo (Salario)</span>
                  <Wallet className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
                </div>
                <p className="text-xs text-zinc-500">
                  Sueldo fijo quincenal, mensual o anual proyectado automáticamente.
                </p>
              </button>

              <button
                type="button"
                data-testid="mode-informal-btn"
                onClick={() => setIncomeMode('INFORMAL')}
                className={`p-4 rounded-lg border text-left transition ${
                  incomeMode === 'INFORMAL'
                    ? 'bg-[#09090B] border-emerald-500 text-white'
                    : 'bg-[#09090B] border-[#27272A] text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm">Ingreso Variable / Independiente</span>
                  <CreditCard className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
                </div>
                <p className="text-xs text-zinc-500">
                  Defines el presupuesto disponible al comenzar cada ciclo.
                </p>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Moneda Principal
                </label>
                <select
                  data-testid="onboarding-currency"
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white"
                >
                  {Object.values(CURRENCY_CONFIGS).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Ciclo de Control
                </label>
                <select
                  data-testid="onboarding-cycle-type"
                  value={cycleType}
                  onChange={(e) => setCycleType(e.target.value as CycleType)}
                  className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white"
                >
                  <option value="MONTHLY">Mensual (30 días)</option>
                  <option value="BIWEEKLY">Quincenal (15 días)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {incomeMode === 'FIXED' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Frecuencia de tu Salario
                  </label>
                  <select
                    data-testid="onboarding-salary-freq"
                    value={salaryFrequency}
                    onChange={(e) => setSalaryFrequency(e.target.value as SalaryFrequency)}
                    className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white"
                  >
                    <option value="MONTHLY">Mensual</option>
                    <option value="BIWEEKLY">Quincenal</option>
                    <option value="ANNUAL">Anual (Prorrateado)</option>
                  </select>
                </div>
              )}

              <div className={incomeMode === 'INFORMAL' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  {incomeMode === 'FIXED'
                    ? 'Monto de tu Salario'
                    : 'Presupuesto Disponible para este Período'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  data-testid="onboarding-income-input"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white font-semibold tabular-nums"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[#27272A]">
              <button
                type="submit"
                disabled={loading}
                data-testid="onboarding-step1-next"
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition"
              >
                Continuar a Gastos Fijos
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </form>
        )}

        {/* PASO 2 */}
        {step === 2 && (
          <div className="mt-6 space-y-5">
            <div>
              <h3 className="text-sm sm:text-base font-medium text-white">
                2. Gastos Fijos y Compromisos
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Registra tus pagos obligatorios del ciclo (arriendo, servicios, transporte,
                alimentación).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-zinc-500 self-center mr-1">Sugerencias:</span>
              <button
                type="button"
                onClick={() =>
                  handleQuickPresetExpense('Arriendo', cur === 'USD' ? 450 : 500000, 'MONTHLY')
                }
                className="px-2.5 py-1.5 rounded-md bg-[#09090B] hover:bg-zinc-900 text-xs text-zinc-300 border border-[#27272A] tabular-nums transition"
              >
                + Arriendo ({formatCurrency(cur === 'USD' ? 450 : 500000, cur)})
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickPresetExpense(
                    'Servicios públicos',
                    cur === 'USD' ? 120 : 200000,
                    'MONTHLY'
                  )
                }
                className="px-2.5 py-1.5 rounded-md bg-[#09090B] hover:bg-zinc-900 text-xs text-zinc-300 border border-[#27272A] tabular-nums transition"
              >
                + Servicios ({formatCurrency(cur === 'USD' ? 120 : 200000, cur)})
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickPresetExpense(
                    'Corte de cabello / motilada',
                    cur === 'USD' ? 15 : 15000,
                    'BIWEEKLY'
                  )
                }
                className="px-2.5 py-1.5 rounded-md bg-[#09090B] hover:bg-zinc-900 text-xs text-zinc-300 border border-[#27272A] tabular-nums transition"
              >
                + Barbería ({formatCurrency(cur === 'USD' ? 15 : 15000, cur)})
              </button>
            </div>

            <form
              onSubmit={handleAddOnboardingExpense}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-lg bg-[#09090B] border border-[#27272A]"
            >
              <div className="sm:col-span-4">
                <label className="block text-[11px] text-zinc-500 mb-1">Concepto</label>
                <input
                  type="text"
                  required
                  data-testid="onboarding-expense-name"
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  placeholder="Ej. Arriendo..."
                  className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-md text-xs text-white"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] text-zinc-500 mb-1">Monto</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  data-testid="onboarding-expense-amount"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="500000"
                  className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-md text-xs text-white tabular-nums"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] text-zinc-500 mb-1">Frecuencia</label>
                <select
                  data-testid="onboarding-expense-freq"
                  value={expFreq}
                  onChange={(e) => setExpFreq(e.target.value as ExpenseFrequency)}
                  className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-md text-xs text-white"
                >
                  <option value="MONTHLY">Mensual</option>
                  <option value="BIWEEKLY">Quincenal</option>
                  <option value="ONCE">Único en el ciclo</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  data-testid="onboarding-expense-add"
                  className="w-full py-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Agregar
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {workspace.mandatoryExpenses.length === 0 ? (
                <div className="p-5 text-center rounded-lg border border-dashed border-[#27272A] text-zinc-500 text-xs">
                  Aún no has registrado compromisos fijos.
                </div>
              ) : (
                workspace.mandatoryExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#09090B] border border-[#27272A]"
                  >
                    <div>
                      <span className="text-xs font-medium text-white">{exp.name}</span>
                      <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-[#121215] border border-[#27272A] text-zinc-400">
                        {exp.frequency === 'MONTHLY'
                          ? 'Mensual'
                          : exp.frequency === 'BIWEEKLY'
                            ? 'Quincenal'
                            : 'Único'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-white tabular-nums">
                        {formatCurrency(exp.amount, cur)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="text-zinc-500 hover:text-zinc-200"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3.5 rounded-lg bg-[#09090B] border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-zinc-400">Ingreso Neto Disponible (IND):</span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {formatCurrency(workspace.analysis.netAvailableIncome, cur)}
              </span>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-[#27272A]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-[#09090B] hover:bg-zinc-900 border border-[#27272A] text-zinc-300 text-xs font-medium"
              >
                Atrás
              </button>
              <button
                type="button"
                data-testid="onboarding-step2-next"
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition"
              >
                Continuar a Meta de Ahorro
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        {/* PASO 3 */}
        {step === 3 && (
          <form onSubmit={handleFinishStep3} className="mt-6 space-y-5">
            <div>
              <h3 className="text-sm sm:text-base font-medium text-white">
                3. Define tu Primera Meta
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                ¿Qué quieres comprar o alcanzar y en cuánto tiempo planeas lograrlo?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Objetivo o Producto
                </label>
                <input
                  type="text"
                  required
                  data-testid="onboarding-goal-name"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder='Ej. "Portátil para desarrollo", "Moto", "Viaje"'
                  className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Valor Objetivo ({cur})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  data-testid="onboarding-goal-price"
                  value={goalPrice}
                  onChange={(e) => setGoalPrice(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white font-semibold tabular-nums"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Plazo</label>
                  <input
                    type="number"
                    required
                    min="1"
                    data-testid="onboarding-goal-duration-val"
                    value={goalDurationVal}
                    onChange={(e) => setGoalDurationVal(e.target.value)}
                    className="w-full px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white font-semibold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Unidad</label>
                  <select
                    data-testid="onboarding-goal-duration-unit"
                    value={goalDurationUnit}
                    onChange={(e) => setGoalDurationUnit(e.target.value as DurationUnit)}
                    className="w-full px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white"
                  >
                    <option value="DAYS">Días</option>
                    <option value="WEEKS">Semanas</option>
                    <option value="MONTHS">Meses</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-[#27272A]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg bg-[#09090B] hover:bg-zinc-900 border border-[#27272A] text-zinc-300 text-xs font-medium"
              >
                Atrás
              </button>
              <button
                type="submit"
                disabled={loading}
                data-testid="onboarding-finish-btn"
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition"
              >
                <Target className="w-4 h-4" strokeWidth={1.5} />
                {loading ? 'Preparando tu panel...' : 'Finalizar y Ver mi Panel'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
