import {
  FinancialAnalysisOutput,
  ChecklistStatus,
  CycleType,
  DurationUnit,
  ExpenseFrequency,
  IncomeMode,
  SalaryFrequency,
} from '../shared/financialEngine';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  currency: string;
  income_mode: IncomeMode;
  cycle_type: CycleType;
  fixed_salary_amount: number;
  salary_frequency: SalaryFrequency;
  weekend_percentage: number;
  onboarding_done: boolean;
  created_at: string;
}

export interface IncomeCycleRecord {
  id: string;
  user_id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  declared_income: number;
  status: 'ACTIVE' | 'CLOSED';
  created_at: string;
}

export interface MandatoryExpenseRecord {
  id: string;
  user_id: string;
  cycle_id: string | null;
  name: string;
  category: string;
  amount: number;
  frequency: ExpenseFrequency;
  is_recurring: boolean;
  is_paid: boolean;
}

export interface SavingsGoalRecord {
  id: string;
  user_id: string;
  product_name: string;
  target_amount: number;
  saved_amount: number;
  duration_value: number;
  duration_unit: DurationUnit;
  priority: number;
  allocation_pct: number;
  is_primary: boolean;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  start_date: string;
  target_date: string;
}

export interface TrackingChecklistRecord {
  id: string;
  goal_id: string;
  cycle_id: string;
  period_label: string;
  period_type: 'WEEKLY' | 'WEEKEND' | 'CYCLE_CLOSE';
  period_days: number;
  budget_limit: number;
  actual_spent: number;
  deviation: number;
  status: ChecklistStatus;
  days_impact: number;
  notes?: string;
  recorded_at: string;
}

export interface WorkspaceState {
  token?: string;
  user: UserProfile;
  activeCycle: IncomeCycleRecord;
  cyclesHistory: IncomeCycleRecord[];
  mandatoryExpenses: MandatoryExpenseRecord[];
  savingsGoals: SavingsGoalRecord[];
  trackingChecklists: TrackingChecklistRecord[];
  analysis: FinancialAnalysisOutput;
}

const TOKEN_STORAGE_KEY = 'kuota_bearer_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export async function apiRequest<T = WorkspaceState>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }

  if (data.token) {
    setStoredToken(data.token);
  }

  return data as T;
}
