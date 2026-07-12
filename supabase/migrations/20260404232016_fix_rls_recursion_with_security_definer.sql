-- Drop all recursive inline-subquery policies first
DROP POLICY IF EXISTS "Admin can read all profiles"            ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles"          ON profiles;
DROP POLICY IF EXISTS "Admin can read all weight entries"      ON weight_entries;
DROP POLICY IF EXISTS "Admin can read all workout logs"        ON workout_logs;
DROP POLICY IF EXISTS "Admin can read all exercise logs"       ON exercise_logs;
DROP POLICY IF EXISTS "Admin can read all meal logs"           ON meal_logs;
DROP POLICY IF EXISTS "Admin can read all meal log foods"      ON meal_log_foods;
DROP POLICY IF EXISTS "Admin manages quotes"                   ON daily_quotes;
DROP POLICY IF EXISTS "Admin manages recipes"                  ON recipes;
DROP POLICY IF EXISTS "Admin manages ingredients"              ON recipe_ingredients;
DROP POLICY IF EXISTS "Admin manages meal plan recipes"        ON meal_plan_recipes;
DROP POLICY IF EXISTS "Admin can manage all workouts"          ON workouts;
DROP POLICY IF EXISTS "Admin can manage all workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Admin can manage all meal plans"        ON meal_plans;
DROP POLICY IF EXISTS "Admin can manage all meals"             ON meals;
DROP POLICY IF EXISTS "Admin can manage all meal foods"        ON meal_foods;

-- SECURITY DEFINER function runs as postgres (superuser) → bypasses RLS
-- on the profiles lookup, so no recursion is possible.
-- Named get_is_admin() to avoid conflict with the profiles.is_admin column.
-- SET search_path ensures auth.uid() is reachable.
CREATE OR REPLACE FUNCTION public.get_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT COALESCE(p.is_admin, FALSE)
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

-- profiles
CREATE POLICY "Admin can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (get_is_admin() OR auth.uid() = id);

CREATE POLICY "Admin can update all profiles"
  ON profiles FOR UPDATE TO authenticated
  USING      (get_is_admin() OR auth.uid() = id)
  WITH CHECK (get_is_admin() OR auth.uid() = id);

-- weight_entries
CREATE POLICY "Admin can read all weight entries"
  ON weight_entries FOR SELECT TO authenticated
  USING (get_is_admin() OR auth.uid() = user_id);

-- workout_logs
CREATE POLICY "Admin can read all workout logs"
  ON workout_logs FOR SELECT TO authenticated
  USING (get_is_admin() OR auth.uid() = user_id);

-- exercise_logs
CREATE POLICY "Admin can read all exercise logs"
  ON exercise_logs FOR SELECT TO authenticated
  USING (
    get_is_admin()
    OR EXISTS (SELECT 1 FROM workout_logs wl WHERE wl.id = workout_log_id AND wl.user_id = auth.uid())
  );

-- meal_logs
CREATE POLICY "Admin can read all meal logs"
  ON meal_logs FOR SELECT TO authenticated
  USING (get_is_admin() OR auth.uid() = user_id);

-- meal_log_foods
CREATE POLICY "Admin can read all meal log foods"
  ON meal_log_foods FOR SELECT TO authenticated
  USING (
    get_is_admin()
    OR EXISTS (SELECT 1 FROM meal_logs ml WHERE ml.id = meal_log_id AND ml.user_id = auth.uid())
  );

-- daily_quotes
CREATE POLICY "Admin manages quotes"
  ON daily_quotes FOR ALL TO authenticated
  USING      (get_is_admin())
  WITH CHECK (get_is_admin());

-- recipes
CREATE POLICY "Admin manages recipes"
  ON recipes FOR ALL TO authenticated
  USING      (get_is_admin())
  WITH CHECK (get_is_admin());

-- recipe_ingredients
CREATE POLICY "Admin manages ingredients"
  ON recipe_ingredients FOR ALL TO authenticated
  USING      (get_is_admin())
  WITH CHECK (get_is_admin());

-- meal_plan_recipes
CREATE POLICY "Admin manages meal plan recipes"
  ON meal_plan_recipes FOR ALL TO authenticated
  USING      (get_is_admin())
  WITH CHECK (get_is_admin());

-- workouts
CREATE POLICY "Admin can manage all workouts"
  ON workouts FOR ALL TO authenticated
  USING      (get_is_admin())
  WITH CHECK (get_is_admin());

-- workout_exercises
CREATE POLICY "Admin can manage all workout exercises"
  ON workout_exercises FOR ALL TO authenticated
  USING      (get_is_admin())
  WITH CHECK (get_is_admin());

-- meal_plans
CREATE POLICY "Admin can manage all meal plans"
  ON meal_plans FOR ALL TO authenticated
  USING      (get_is_admin())
  WITH CHECK (get_is_admin());

-- meals
CREATE POLICY "Admin can manage all meals"
  ON meals FOR ALL TO authenticated
  USING      (get_is_admin())
  WITH CHECK (get_is_admin());

-- meal_foods
CREATE POLICY "Admin can manage all meal foods"
  ON meal_foods FOR ALL TO authenticated
  USING      (get_is_admin())
  WITH CHECK (get_is_admin());
