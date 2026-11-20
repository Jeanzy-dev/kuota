import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export interface DbQueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

const INITIAL_SCHEMA_SQL = `
DO $$ BEGIN
  CREATE TYPE "IncomeMode" AS ENUM ('FIXED', 'INFORMAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CycleType" AS ENUM ('BIWEEKLY', 'MONTHLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalaryFrequency" AS ENUM ('BIWEEKLY', 'MONTHLY', 'ANNUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CycleStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseFrequency" AS ENUM ('BIWEEKLY', 'MONTHLY', 'ONCE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DurationUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ChecklistStatus" AS ENUM ('ON_TRACK', 'OVER_BUDGET', 'SAVED_EXTRA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Usuario',
    "password_hash" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "income_mode" "IncomeMode" NOT NULL DEFAULT 'FIXED',
    "cycle_type" "CycleType" NOT NULL DEFAULT 'MONTHLY',
    "fixed_salary_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salary_frequency" "SalaryFrequency" NOT NULL DEFAULT 'MONTHLY',
    "weekend_percentage" INTEGER NOT NULL DEFAULT 55,
    "onboarding_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "income_cycles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period_name" TEXT NOT NULL DEFAULT '',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "declared_income" DECIMAL(12,2) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "income_cycles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "income_cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "mandatory_expenses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cycle_id" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" "ExpenseFrequency" NOT NULL DEFAULT 'MONTHLY',
    "is_recurring" BOOLEAN NOT NULL DEFAULT true,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mandatory_expenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mandatory_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mandatory_expenses_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "income_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "savings_goals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "target_amount" DECIMAL(12,2) NOT NULL,
    "saved_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "duration_value" INTEGER NOT NULL,
    "duration_unit" "DurationUnit" NOT NULL DEFAULT 'MONTHS',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "allocation_pct" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "target_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "savings_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "tracking_checklists" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "period_label" TEXT NOT NULL,
    "period_type" TEXT NOT NULL DEFAULT 'WEEKLY',
    "period_days" INTEGER NOT NULL DEFAULT 7,
    "budget_limit" DECIMAL(12,2) NOT NULL,
    "actual_spent" DECIMAL(12,2) NOT NULL,
    "deviation" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "ChecklistStatus" NOT NULL,
    "days_impact" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tracking_checklists_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tracking_checklists_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tracking_checklists_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "income_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "income_cycles_user_id_idx" ON "income_cycles"("user_id");
CREATE INDEX IF NOT EXISTS "mandatory_expenses_user_id_idx" ON "mandatory_expenses"("user_id");
CREATE INDEX IF NOT EXISTS "mandatory_expenses_cycle_id_idx" ON "mandatory_expenses"("cycle_id");
CREATE INDEX IF NOT EXISTS "savings_goals_user_id_idx" ON "savings_goals"("user_id");
CREATE INDEX IF NOT EXISTS "tracking_checklists_goal_id_idx" ON "tracking_checklists"("goal_id");
CREATE INDEX IF NOT EXISTS "tracking_checklists_cycle_id_idx" ON "tracking_checklists"("cycle_id");
`;

class DatabaseManager {
  private pgPool: Pool | null = null;
  private pglite: any = null;
  private initialized = false;
  private mode: 'POSTGRES_SERVER' | 'PGLITE_EMBEDDED' = 'PGLITE_EMBEDDED';

  public getMode() {
    return this.mode;
  }

  private resolveDatabaseUrl(): string {
    return (
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.NEON_DATABASE_URL ||
      ''
    ).trim();
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    const dbUrl = this.resolveDatabaseUrl();
    const useExternalPg =
      dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

    if (useExternalPg) {
      try {
        const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
        const pool = new Pool({
          connectionString: dbUrl,
          connectionTimeoutMillis: 10000,
          ssl: !isLocalhost ? { rejectUnauthorized: false } : undefined,
        });
        await pool.query('SELECT 1');
        this.pgPool = pool;
        this.mode = 'POSTGRES_SERVER';
        await this.ensureSchema();
        this.initialized = true;
        console.log('[DB] Conectado exitosamente a servidor PostgreSQL externo.');
        return;
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
          console.error('[DB] Error conectando a PostgreSQL en producción:', err.message);
          throw new Error(`Error conectando a PostgreSQL (DATABASE_URL): ${err.message}`);
        }
        console.warn(
          `[DB] No se detectó servidor PostgreSQL activo en ${dbUrl} (${err.message}). Iniciando motor PostgreSQL local (PGlite)...`
        );
      }
    } else if (process.env.VERCEL) {
      throw new Error(
        'No se encontró la variable de entorno DATABASE_URL en Vercel. Por favor agrégala en Settings -> Environment Variables y haz Redeploy.'
      );
    }

    // Carga dinámica de PGlite solo para entorno local / pruebas (evita errores de WASM en Vercel Serverless)
    const { PGlite } = await import('@electric-sql/pglite');
    const path = await import('path');
    const dataDir =
      process.env.PGLITE_DATA_DIR === 'memory://'
        ? undefined
        : path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR || '.pgdata');

    this.pglite = new PGlite(dataDir);
    await this.pglite.waitReady;
    this.mode = 'PGLITE_EMBEDDED';
    await this.ensureSchema();
    this.initialized = true;
    console.log(
      `[DB] Motor PostgreSQL persistente inicializado (${dataDir ? dataDir : 'in-memory'}).`
    );
  }

  private async ensureSchema(): Promise<void> {
    const check = await this.rawQuery<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      ) as exists;`
    );

    const exists = check.rows[0]?.exists === true || (check.rows[0] as any)?.exists === 't';
    if (!exists) {
      if (this.pgPool) {
        await this.pgPool.query(INITIAL_SCHEMA_SQL);
      } else if (this.pglite) {
        await this.pglite.exec(INITIAL_SCHEMA_SQL);
      }
      console.log('[DB] Esquema relacional PostgreSQL aplicado correctamente.');
    }
  }

  private async rawQuery<T = any>(sql: string, params: any[] = []): Promise<DbQueryResult<T>> {
    if (this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rowCount || 0 };
    }
    if (this.pglite) {
      const res = await this.pglite.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rows.length };
    }
    throw new Error('Base de datos no inicializada');
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<DbQueryResult<T>> {
    if (!this.initialized) {
      await this.init();
    }
    return this.rawQuery<T>(sql, params);
  }
}

export const db = new DatabaseManager();
