-- Drop all policies that depend on is_admin(), then the function, then recreate.
DROP POLICY IF EXISTS "Admin can read all profiles"           ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles"         ON profiles;
DROP POLICY IF EXISTS "Admin can read all weight entries"     ON weight_entries;
DROP POLICY IF EXISTS "Admin can read all workout logs"       ON workout_logs;
DROP POLICY IF EXISTS "Admin can read all exercise logs"      ON exercise_logs;
DROP POLICY IF EXISTS "Admin can read all meal logs"          ON meal_logs;
DROP POLICY IF EXISTS "Admin can read all meal log foods"     ON meal_log_foods;
DROP POLICY IF EXISTS "Admin manages quotes"                  ON daily_quotes;
DROP POLICY IF EXISTS "Admin manages recipes"                 ON recipes;
DROP POLICY IF EXISTS "Admin manages ingredients"             ON recipe_ingredients;
DROP POLICY IF EXISTS "Admin manages meal plan recipes"       ON meal_plan_recipes;
DROP POLICY IF EXISTS "Admin can manage all workouts"         ON workouts;
DROP POLICY IF EXISTS "Admin can manage all workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Admin can manage all meal plans"       ON meal_plans;
DROP POLICY IF EXISTS "Admin can manage all meals"            ON meals;
DROP POLICY IF EXISTS "Admin can manage all meal foods"       ON meal_foods;

DROP FUNCTION IF EXISTS is_admin();

-- Recreate all policies using inline subquery instead of function.
-- Subquery is cached per statement by Postgres planner — no perf issue.

CREATE POLICY "Admin can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) OR auth.uid() = id);

CREATE POLICY "Admin can update all profiles"
  ON profiles FOR UPDATE TO authenticated
  USING      ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) OR auth.uid() = id)
  WITH CHECK ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) OR auth.uid() = id);

CREATE POLICY "Admin can read all weight entries"
  ON weight_entries FOR SELECT TO authenticated
  USING ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "Admin can read all workout logs"
  ON workout_logs FOR SELECT TO authenticated
  USING ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "Admin can read all exercise logs"
  ON exercise_logs FOR SELECT TO authenticated
  USING (
    (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid())
    OR EXISTS (SELECT 1 FROM workout_logs wl WHERE wl.id = workout_log_id AND wl.user_id = auth.uid())
  );

CREATE POLICY "Admin can read all meal logs"
  ON meal_logs FOR SELECT TO authenticated
  USING ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "Admin can read all meal log foods"
  ON meal_log_foods FOR SELECT TO authenticated
  USING (
    (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid())
    OR EXISTS (SELECT 1 FROM meal_logs ml WHERE ml.id = meal_log_id AND ml.user_id = auth.uid())
  );

CREATE POLICY "Admin manages quotes"
  ON daily_quotes FOR ALL TO authenticated
  USING      ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admin manages recipes"
  ON recipes FOR ALL TO authenticated
  USING      ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admin manages ingredients"
  ON recipe_ingredients FOR ALL TO authenticated
  USING      ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admin manages meal plan recipes"
  ON meal_plan_recipes FOR ALL TO authenticated
  USING      ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admin can manage all workouts"
  ON workouts FOR ALL TO authenticated
  USING      ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admin can manage all workout exercises"
  ON workout_exercises FOR ALL TO authenticated
  USING      ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admin can manage all meal plans"
  ON meal_plans FOR ALL TO authenticated
  USING      ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admin can manage all meals"
  ON meals FOR ALL TO authenticated
  USING      ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admin can manage all meal foods"
  ON meal_foods FOR ALL TO authenticated
  USING      ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK ((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()));
