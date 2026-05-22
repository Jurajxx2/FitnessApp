-- supabase/migrations/20260522000000_meal_plan_weekly.sql

-- 1. Add day_of_week to meals (0=Mon … 6=Sun; NULL = every day / legacy)
ALTER TABLE meals ADD COLUMN IF NOT EXISTS day_of_week INTEGER;

-- 2. Join table: many users ↔ many meal plans
CREATE TABLE IF NOT EXISTS user_meal_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id  UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, meal_plan_id)
);

ALTER TABLE user_meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own assignments"
  ON user_meal_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage assignments"
  ON user_meal_plans FOR ALL TO authenticated
  USING (get_is_admin());

CREATE INDEX IF NOT EXISTS idx_ump_user ON user_meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_ump_plan ON user_meal_plans(meal_plan_id);

-- 3. Fix broken admin RLS (coach_id was never set, so all mutations silently failed)

-- meal_plans: admin write access
DROP POLICY IF EXISTS "Admins can manage meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Admin can manage all meal plans" ON meal_plans;
CREATE POLICY "Admins manage meal plans"
  ON meal_plans FOR ALL TO authenticated USING (get_is_admin());

-- meal_plans: user read — now uses join table
DROP POLICY IF EXISTS "Users can read assigned meal plans" ON meal_plans;
CREATE POLICY "Users read assigned meal plans"
  ON meal_plans FOR SELECT
  USING (
    user_id IS NULL  -- legacy global templates
    OR EXISTS (
      SELECT 1 FROM user_meal_plans ump
      WHERE ump.meal_plan_id = id AND ump.user_id = auth.uid()
    )
  );

-- meals: admin write access
DROP POLICY IF EXISTS "Admins can manage meals" ON meals;
DROP POLICY IF EXISTS "Admin can manage all meals" ON meals;
CREATE POLICY "Admins manage meals"
  ON meals FOR ALL TO authenticated USING (get_is_admin());

-- meals: user read — join table aware
DROP POLICY IF EXISTS "Users can read meals for accessible plans" ON meals;
CREATE POLICY "Users read meals for accessible plans"
  ON meals FOR SELECT
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

-- meal_foods: admin write access + user read — join table aware
DROP POLICY IF EXISTS "Admin can manage all meal foods" ON meal_foods;
CREATE POLICY "Admins manage meal foods"
  ON meal_foods FOR ALL TO authenticated USING (get_is_admin());

DROP POLICY IF EXISTS "Users can read meal foods for accessible plans" ON meal_foods;
CREATE POLICY "Users read meal foods for accessible plans"
  ON meal_foods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meals m
      JOIN meal_plans mp ON mp.id = m.meal_plan_id
      WHERE m.id = meal_id
      AND (
        mp.user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_meal_plans ump
          WHERE ump.meal_plan_id = mp.id AND ump.user_id = auth.uid()
        )
      )
    )
  );

-- meal_plan_recipes: admin write access
DROP POLICY IF EXISTS "Admin manages meal plan recipes"   ON meal_plan_recipes;
DROP POLICY IF EXISTS "Admins manage meal plan recipes"  ON meal_plan_recipes;
CREATE POLICY "Admins manage meal plan recipes"
  ON meal_plan_recipes FOR ALL TO authenticated USING (get_is_admin());
