-- ============================================================
-- Coach Foška — Admin Schema Migration
-- Run in Supabase SQL Editor AFTER schema.sql
--
-- After running:
--   1. Supabase → Table Editor → profiles
--   2. Find the coach row (by email)
--   3. Set is_admin = true
-- ============================================================

-- ── Admin flag + extra profile columns ──────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_blocked  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- ── is_admin() helper ────────────────────────────────────────
-- SECURITY DEFINER: runs as the function owner → bypasses RLS
-- on the profiles lookup (no infinite recursion).
-- STABLE: Postgres can cache the result within one query.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(is_admin, FALSE) FROM profiles WHERE id = auth.uid()
$$;

-- ── profiles ─────────────────────────────────────────────────
-- Users still read/update their own row (from schema.sql).
-- Add admin-side policies on top.

DROP POLICY IF EXISTS "Coach can read all profiles"   ON profiles;
DROP POLICY IF EXISTS "Coach can update all profiles" ON profiles;

CREATE POLICY "Admin can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (is_admin() OR auth.uid() = id);

CREATE POLICY "Admin can update all profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (is_admin() OR auth.uid() = id);

-- ── weight_entries ───────────────────────────────────────────
-- Admin can read all (for client progress overview).
CREATE POLICY "Admin can read all weight entries"
  ON weight_entries FOR SELECT TO authenticated
  USING (is_admin() OR auth.uid() = user_id);

-- ── workouts ─────────────────────────────────────────────────
-- schema.sql uses coach_id = auth.uid() — replace with is_admin().
DROP POLICY IF EXISTS "Admins can manage workouts" ON workouts;

CREATE POLICY "Admin can manage all workouts"
  ON workouts FOR ALL TO authenticated
  USING (is_admin());

-- ── workout_exercises ─────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage workout exercises" ON workout_exercises;

CREATE POLICY "Admin can manage all workout exercises"
  ON workout_exercises FOR ALL TO authenticated
  USING (is_admin());

-- ── workout_logs + exercise_logs (read-only for admin) ────────
CREATE POLICY "Admin can read all workout logs"
  ON workout_logs FOR SELECT TO authenticated
  USING (is_admin() OR auth.uid() = user_id);

CREATE POLICY "Admin can read all exercise logs"
  ON exercise_logs FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM workout_logs wl
      WHERE wl.id = workout_log_id AND wl.user_id = auth.uid()
    )
  );

-- ── meal_plans + meals + meal_foods ──────────────────────────
DROP POLICY IF EXISTS "Admins can manage meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Admins can manage meals"      ON meals;
DROP POLICY IF EXISTS "Admins can manage meal foods" ON meal_foods;

CREATE POLICY "Admin can manage all meal plans"
  ON meal_plans FOR ALL TO authenticated
  USING (is_admin());

CREATE POLICY "Admin can manage all meals"
  ON meals FOR ALL TO authenticated
  USING (is_admin());

CREATE POLICY "Admin can manage all meal foods"
  ON meal_foods FOR ALL TO authenticated
  USING (is_admin());

-- ── meal_logs + meal_log_foods (read-only for admin) ─────────
CREATE POLICY "Admin can read all meal logs"
  ON meal_logs FOR SELECT TO authenticated
  USING (is_admin() OR auth.uid() = user_id);

CREATE POLICY "Admin can read all meal log foods"
  ON meal_log_foods FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM meal_logs ml
      WHERE ml.id = meal_log_id AND ml.user_id = auth.uid()
    )
  );

-- ── daily_quotes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_quotes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text           TEXT NOT NULL,
  author         TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_date DATE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE daily_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read quotes" ON daily_quotes;
DROP POLICY IF EXISTS "Coach manages quotes"            ON daily_quotes;

-- All authenticated users can read quotes (shown in app)
CREATE POLICY "Authenticated users read quotes"
  ON daily_quotes FOR SELECT TO authenticated
  USING (true);

-- Only admin can create / edit / delete
CREATE POLICY "Admin manages quotes"
  ON daily_quotes FOR ALL TO authenticated
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_daily_quotes_active ON daily_quotes(is_active);
CREATE INDEX IF NOT EXISTS idx_daily_quotes_date   ON daily_quotes(scheduled_date);

-- ── recipes ──────────────────────────────────────────────────
-- Reusable recipe templates created by coach; readable by all users.
CREATE TABLE IF NOT EXISTS recipes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  prep_time_min INTEGER,
  servings      INTEGER NOT NULL DEFAULT 1,
  calories      REAL NOT NULL DEFAULT 0,
  protein_g     REAL NOT NULL DEFAULT 0,
  carbs_g       REAL NOT NULL DEFAULT 0,
  fat_g         REAL NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read recipes" ON recipes;
DROP POLICY IF EXISTS "Coach manages recipes"            ON recipes;

CREATE POLICY "Authenticated users read recipes"
  ON recipes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manages recipes"
  ON recipes FOR ALL TO authenticated
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name);

-- ── recipe_ingredients ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  quantity   REAL,
  unit       TEXT,
  calories   REAL NOT NULL DEFAULT 0,
  protein_g  REAL NOT NULL DEFAULT 0,
  carbs_g    REAL NOT NULL DEFAULT 0,
  fat_g      REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Coach manages ingredients"           ON recipe_ingredients;

CREATE POLICY "Authenticated users read ingredients"
  ON recipe_ingredients FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manages ingredients"
  ON recipe_ingredients FOR ALL TO authenticated
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
  ON recipe_ingredients(recipe_id, sort_order);

-- ── meal_plan_recipes ─────────────────────────────────────────
-- Links recipe templates into meal plan slots.
CREATE TABLE IF NOT EXISTS meal_plan_recipes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id    UUID NOT NULL REFERENCES recipes(id)    ON DELETE CASCADE,
  meal_id      UUID REFERENCES meals(id) ON DELETE SET NULL,
  meal_type    TEXT,     -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
  day_of_week  INTEGER,  -- 0=Mon…6=Sun; NULL = every day
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meal_plan_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read meal plan recipes" ON meal_plan_recipes;
DROP POLICY IF EXISTS "Coach manages meal plan recipes"           ON meal_plan_recipes;

CREATE POLICY "Authenticated users read meal plan recipes"
  ON meal_plan_recipes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manages meal plan recipes"
  ON meal_plan_recipes FOR ALL TO authenticated
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_mpr_plan   ON meal_plan_recipes(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_mpr_recipe ON meal_plan_recipes(recipe_id);
