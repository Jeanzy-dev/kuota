-- CreateEnum
CREATE TYPE "IncomeMode" AS ENUM ('FIXED', 'INFORMAL');
CREATE TYPE "CycleType" AS ENUM ('BIWEEKLY', 'MONTHLY');
CREATE TYPE "SalaryFrequency" AS ENUM ('BIWEEKLY', 'MONTHLY', 'ANNUAL');
CREATE TYPE "CycleStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "ExpenseFrequency" AS ENUM ('BIWEEKLY', 'MONTHLY', 'ONCE');
CREATE TYPE "DurationUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS');
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED');
CREATE TYPE "ChecklistStatus" AS ENUM ('ON_TRACK', 'OVER_BUDGET', 'SAVED_EXTRA');

-- CreateTable
CREATE TABLE "users" (
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

-- CreateTable
CREATE TABLE "income_cycles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period_name" TEXT NOT NULL DEFAULT '',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "declared_income" DECIMAL(12,2) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandatory_expenses" (
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

    CONSTRAINT "mandatory_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_goals" (
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

    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_checklists" (
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

    CONSTRAINT "tracking_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "income_cycles_user_id_idx" ON "income_cycles"("user_id");
CREATE INDEX "mandatory_expenses_user_id_idx" ON "mandatory_expenses"("user_id");
CREATE INDEX "mandatory_expenses_cycle_id_idx" ON "mandatory_expenses"("cycle_id");
CREATE INDEX "savings_goals_user_id_idx" ON "savings_goals"("user_id");
CREATE INDEX "tracking_checklists_goal_id_idx" ON "tracking_checklists"("goal_id");
CREATE INDEX "tracking_checklists_cycle_id_idx" ON "tracking_checklists"("cycle_id");

-- AddForeignKey
ALTER TABLE "income_cycles" ADD CONSTRAINT "income_cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mandatory_expenses" ADD CONSTRAINT "mandatory_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mandatory_expenses" ADD CONSTRAINT "mandatory_expenses_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "income_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracking_checklists" ADD CONSTRAINT "tracking_checklists_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracking_checklists" ADD CONSTRAINT "tracking_checklists_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "income_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
