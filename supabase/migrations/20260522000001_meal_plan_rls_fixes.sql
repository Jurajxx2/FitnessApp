-- supabase/migrations/20260522000001_meal_plan_rls_fixes.sql
-- Corrective migration for issues found after 20260522000000_meal_plan_weekly.sql

-- NOTE: The DB function is named get_is_admin() (verified via pg_proc).
-- All 5 admin policies in the previous migration already use get_is_admin() correctly.
-- No admin policy name fix is needed here.

-- Fix 1: Scope meal_plan_recipes SELECT (was open to all authenticated users via USING (true))
DROP POLICY IF EXISTS "Authenticated users read meal plan recipes" ON meal_plan_recipes;
CREATE POLICY "Users read meal plan recipes for accessible plans"
  ON meal_plan_recipes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id
      AND (
        mp.user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_meal_plans ump
          WHERE ump.meal_plan_id = mp.id AND ump.user_id = auth.uid()
        )
      )
    )
  );

-- Fix 2: Correct self-join bug in meal_plans SELECT policy
-- Previous policy had: ump.meal_plan_id = ump.id (wrong — compares against the ump row's own PK)
-- Correct form:        ump.meal_plan_id = meal_plans.id
DROP POLICY IF EXISTS "Users read assigned meal plans" ON meal_plans;
CREATE POLICY "Users read assigned meal plans"
  ON meal_plans FOR SELECT
  USING (
    user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM user_meal_plans ump
      WHERE ump.meal_plan_id = meal_plans.id AND ump.user_id = auth.uid()
    )
  );

-- Fix 3: Add TO authenticated to user_meal_plans SELECT policy (defence-in-depth)
DROP POLICY IF EXISTS "Users read own assignments" ON user_meal_plans;
CREATE POLICY "Users read own assignments"
  ON user_meal_plans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Fix 4: Backfill existing direct assignments into join table
-- (1 row found with meal_plans.user_id IS NOT NULL)
INSERT INTO user_meal_plans (user_id, meal_plan_id)
SELECT user_id, id FROM meal_plans
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, meal_plan_id) DO NOTHING;

-- Fix 5: Add composite index for day filter queries
CREATE INDEX IF NOT EXISTS idx_meals_plan_day ON meals(meal_plan_id, day_of_week);
