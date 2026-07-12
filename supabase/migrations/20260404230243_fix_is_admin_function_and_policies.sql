-- Fix is_admin() to explicitly set search_path so auth.uid() resolves
-- correctly in the SECURITY DEFINER context.
CREATE OR REPLACE FUNCTION is_admin()
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

-- Recreate all admin write policies with explicit WITH CHECK
-- daily_quotes
DROP POLICY IF EXISTS "Admin manages quotes" ON daily_quotes;
CREATE POLICY "Admin manages quotes"
  ON daily_quotes FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- recipes
DROP POLICY IF EXISTS "Admin manages recipes" ON recipes;
CREATE POLICY "Admin manages recipes"
  ON recipes FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- recipe_ingredients
DROP POLICY IF EXISTS "Admin manages ingredients" ON recipe_ingredients;
CREATE POLICY "Admin manages ingredients"
  ON recipe_ingredients FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- meal_plan_recipes
DROP POLICY IF EXISTS "Admin manages meal plan recipes" ON meal_plan_recipes;
CREATE POLICY "Admin manages meal plan recipes"
  ON meal_plan_recipes FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- workouts
DROP POLICY IF EXISTS "Admin can manage all workouts" ON workouts;
CREATE POLICY "Admin can manage all workouts"
  ON workouts FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- workout_exercises
DROP POLICY IF EXISTS "Admin can manage all workout exercises" ON workout_exercises;
CREATE POLICY "Admin can manage all workout exercises"
  ON workout_exercises FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- meal_plans
DROP POLICY IF EXISTS "Admin can manage all meal plans" ON meal_plans;
CREATE POLICY "Admin can manage all meal plans"
  ON meal_plans FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- meals
DROP POLICY IF EXISTS "Admin can manage all meals" ON meals;
CREATE POLICY "Admin can manage all meals"
  ON meals FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- meal_foods
DROP POLICY IF EXISTS "Admin can manage all meal foods" ON meal_foods;
CREATE POLICY "Admin can manage all meal foods"
  ON meal_foods FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- profiles update
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
CREATE POLICY "Admin can update all profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (is_admin() OR auth.uid() = id)
  WITH CHECK (is_admin() OR auth.uid() = id);
