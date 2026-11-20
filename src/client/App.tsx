import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckSquare,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Target,
  Wallet,
} from 'lucide-react';
import { apiRequest, setStoredToken, WorkspaceState } from './api';
import { AuthAndOnboardingView } from './components/AuthAndOnboardingView';
import { DashboardView } from './components/DashboardView';
import { ChecklistView } from './components/ChecklistView';
import { ExpensesAndCyclesView } from './components/ExpensesAndCyclesView';
import { GoalsView } from './components/GoalsView';
import { GlossaryView } from './components/GlossaryView';
import { formatCurrency } from '../shared/currency';

type ActiveView = 'DASHBOARD' | 'CHECKLIST' | 'EXPENSES' | 'GOALS' | 'GLOSSARY';

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('DASHBOARD');

  useEffect(() => {
    apiRequest<WorkspaceState>('/auth/me')
      .then((ws) => {
        setWorkspace(ws);
      })
      .catch(() => {
        setWorkspace(null);
      })
      .finally(() => {
        setInitializing(false);
      });
  }, []);

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setWorkspace(null);
    setActiveView('DASHBOARD');
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border border-emerald-500 border-t-transparent animate-spin" />
          <span className="text-xs font-medium text-zinc-500">Cargando Kuota...</span>
        </div>
      </div>
    );
  }

  if (!workspace || !workspace.user.onboarding_done) {
    return (
      <AuthAndOnboardingView
        workspace={workspace}
        onUpdateWorkspace={(ws) => setWorkspace(ws)}
      />
    );
  }

  const { user, analysis } = workspace;

  const navItems: {
    id: ActiveView;
    label: string;
    shortLabel: string;
    testId: string;
    icon: React.FC<{ className?: string; strokeWidth?: number }>;
  }[] = [
    {
      id: 'DASHBOARD',
      label: 'Resumen',
      shortLabel: 'Resumen',
      testId: 'nav-dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'CHECKLIST',
      label: 'Control',
      shortLabel: 'Control',
      testId: 'nav-checklist',
      icon: CheckSquare,
    },
    {
      id: 'EXPENSES',
      label: 'Gastos y Ciclos',
      shortLabel: 'Gastos',
      testId: 'nav-expenses',
      icon: CreditCard,
    },
    {
      id: 'GOALS',
      label: `Metas (${workspace.savingsGoals.length})`,
      shortLabel: 'Metas',
      testId: 'nav-goals',
      icon: Target,
    },
    {
      id: 'GLOSSARY',
      label: 'Glosario',
      shortLabel: 'Glosario',
      testId: 'nav-glossary',
      icon: BookOpen,
    },
  ];

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col pb-20 md:pb-0">
      {/* Barra Superior minimalista estilo Linear */}
      <header className="sticky top-0 z-30 bg-[#09090B]/90 backdrop-blur-md border-b border-[#27272A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-sm tracking-tight text-white">Kuota</span>
              <span className="hidden sm:inline text-xs text-zinc-500">
                Planificación Financiera
              </span>
            </div>
          </div>

          {/* Navegación en Escritorio / Tablet */}
          <nav className="hidden md:flex items-center gap-1 bg-[#121215] p-1 rounded-lg border border-[#27272A]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={item.testId}
                  onClick={() => setActiveView(item.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-500'}`}
                    strokeWidth={1.5}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Resumen usuario y Cerrar Sesión */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end text-xs">
              <span className="font-medium text-zinc-200 truncate max-w-[130px] sm:max-w-none">
                {user.name}
              </span>
              <span className="text-[11px] text-zinc-400 tabular-nums">
                PGL: <strong className="text-white font-semibold">{formatCurrency(analysis.freeSpendingBudgetCycle, user.currency)}</strong>
              </span>
            </div>

            <button
              type="button"
              data-testid="logout-btn"
              onClick={handleLogout}
              className="p-2 rounded-lg bg-[#121215] hover:bg-zinc-800/70 border border-[#27272A] text-zinc-500 hover:text-zinc-200 transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'DASHBOARD' && (
          <DashboardView
            workspace={workspace}
            onUpdateWorkspace={setWorkspace}
            onNavigateView={setActiveView}
          />
        )}
        {activeView === 'CHECKLIST' && (
          <ChecklistView
            workspace={workspace}
            onUpdateWorkspace={setWorkspace}
          />
        )}
        {activeView === 'EXPENSES' && (
          <ExpensesAndCyclesView
            workspace={workspace}
            onUpdateWorkspace={setWorkspace}
          />
        )}
        {activeView === 'GOALS' && (
          <GoalsView
            workspace={workspace}
            onUpdateWorkspace={setWorkspace}
          />
        )}
        {activeView === 'GLOSSARY' && <GlossaryView workspace={workspace} />}
      </main>

      {/* Barra Inferior Fija para Móviles */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#121215]/95 backdrop-blur-lg border-t border-[#27272A] px-2 py-1.5 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`mobile-${item.testId}`}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[11px] font-medium transition ${
                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon
                className={`w-4 h-4 mb-0.5 ${isActive ? 'text-emerald-500' : 'text-zinc-500'}`}
                strokeWidth={1.5}
              />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
