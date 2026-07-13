-- Athlete feature access and focused admin operations for the user detail page.
-- Existing athletes keep access to both feature areas.

ALTER TABLE public.profiles
  ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'both'
    CHECK (access_mode IN ('nutrition', 'activity', 'both'));

-- A deleted recipe leaves its macro/name snapshots in historical plans. The
-- Phase-1 foreign key already uses ON DELETE SET NULL, so allow that snapshot
-- form instead of rejecting the delete through the original slot check.
ALTER TABLE public.meal_plan_recipes DROP CONSTRAINT IF EXISTS mpr_slot_shape;

UPDATE public.meal_plan_recipes plan_recipe
SET snapshot_recipe_name = COALESCE(plan_recipe.snapshot_recipe_name, recipe.name),
    snapshot_calories = COALESCE(plan_recipe.snapshot_calories, recipe.calories),
    snapshot_protein_g = COALESCE(plan_recipe.snapshot_protein_g, recipe.protein_g),
    snapshot_carbs_g = COALESCE(plan_recipe.snapshot_carbs_g, recipe.carbs_g),
    snapshot_fat_g = COALESCE(plan_recipe.snapshot_fat_g, recipe.fat_g)
FROM public.recipes recipe
WHERE plan_recipe.recipe_id = recipe.id;

ALTER TABLE public.meal_plan_recipes
  ADD CONSTRAINT mpr_slot_shape CHECK (
    (
      slot_kind = 'recipe'
      AND (
        recipe_id IS NOT NULL
        OR (snapshot_recipe_name IS NOT NULL AND snapshot_calories IS NOT NULL)
      )
    )
    OR (slot_kind = 'external' AND recipe_id IS NULL AND snapshot_calories IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION private.current_user_has_feature(p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.get_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles profile
      WHERE profile.id = (SELECT auth.uid())
        AND (
          profile.access_mode = 'both'
          OR profile.access_mode = p_feature
        )
    )
$$;

REVOKE ALL ON FUNCTION private.current_user_has_feature(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_has_feature(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.protect_profile_access_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.access_mode IS DISTINCT FROM OLD.access_mode
    AND NOT private.get_is_admin()
    AND COALESCE((SELECT auth.role()) = 'service_role', false) = false
  THEN
    RAISE EXCEPTION 'access mode can only be changed by an admin'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_profile_access_mode() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS protect_profile_access_mode ON public.profiles;
CREATE TRIGGER protect_profile_access_mode
  BEFORE UPDATE OF access_mode ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.protect_profile_access_mode();

-- Restrictive policies turn the access mode into a backend entitlement. They
-- are AND-combined with the existing ownership/admin policies.
DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'foods', 'hydration_settings', 'meal_foods', 'meal_log_foods', 'meal_logs',
    'meal_plan_generation_requests', 'meal_plan_recipes', 'meal_plans', 'meals',
    'nutrition_targets', 'recipe_favorites', 'recipe_ingredients', 'recipe_steps',
    'recipes', 'user_meal_plans', 'user_nutrition_preferences', 'water_containers',
    'water_logs'
  ]
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS feature_access_nutrition ON public.%I', target_table);
      EXECUTE format(
        'CREATE POLICY feature_access_nutrition ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.current_user_has_feature(''nutrition''))) WITH CHECK ((SELECT private.current_user_has_feature(''nutrition'')))',
        target_table
      );
    END IF;
  END LOOP;

  FOREACH target_table IN ARRAY ARRAY[
    'equipment', 'exercise_categories', 'exercise_equipment', 'exercise_favorites',
    'exercise_lottie_animations', 'exercise_logs', 'exercise_muscles', 'exercises',
    'general_activity_logs', 'muscles', 'set_logs', 'user_workouts',
    'workout_exercises', 'workout_feedback', 'workout_logs', 'workouts'
  ]
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS feature_access_activity ON public.%I', target_table);
      EXECUTE format(
        'CREATE POLICY feature_access_activity ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.current_user_has_feature(''activity''))) WITH CHECK ((SELECT private.current_user_has_feature(''activity'')))',
        target_table
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_athlete_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_age INTEGER,
  p_height_cm REAL,
  p_weight_kg REAL,
  p_goal TEXT,
  p_activity_level TEXT,
  p_onboarding_complete BOOLEAN,
  p_access_mode TEXT,
  p_admin_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.get_is_admin()) THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_age IS NOT NULL AND p_age NOT BETWEEN 13 AND 120 THEN
    RAISE EXCEPTION 'age must be between 13 and 120' USING ERRCODE = '22023';
  END IF;
  IF p_height_cm IS NOT NULL AND p_height_cm NOT BETWEEN 50 AND 260 THEN
    RAISE EXCEPTION 'height is outside the supported range' USING ERRCODE = '22023';
  END IF;
  IF p_weight_kg IS NOT NULL AND p_weight_kg NOT BETWEEN 20 AND 500 THEN
    RAISE EXCEPTION 'weight is outside the supported range' USING ERRCODE = '22023';
  END IF;
  IF p_goal IS NOT NULL AND p_goal NOT IN ('build_muscle', 'lose_weight', 'stay_fit', 'get_stronger') THEN
    RAISE EXCEPTION 'goal is invalid' USING ERRCODE = '22023';
  END IF;
  IF p_activity_level IS NOT NULL AND p_activity_level NOT IN ('sedentary', 'lightly_active', 'moderately_active', 'active', 'very_active') THEN
    RAISE EXCEPTION 'activity level is invalid' USING ERRCODE = '22023';
  END IF;
  IF p_access_mode NOT IN ('nutrition', 'activity', 'both') THEN
    RAISE EXCEPTION 'access mode is invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET full_name = NULLIF(btrim(p_full_name), ''),
      age = p_age,
      height_cm = p_height_cm,
      weight_kg = p_weight_kg,
      goal = p_goal,
      activity_level = p_activity_level,
      onboarding_complete = COALESCE(p_onboarding_complete, false),
      access_mode = p_access_mode,
      admin_notes = NULLIF(btrim(p_admin_notes), ''),
      updated_at = now()
  WHERE id = p_user_id AND is_admin = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'athlete % does not exist', p_user_id USING ERRCODE = 'P0002';
  END IF;
  RETURN p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_athlete_profile(UUID, TEXT, INTEGER, REAL, REAL, TEXT, TEXT, BOOLEAN, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_athlete_profile(UUID, TEXT, INTEGER, REAL, REAL, TEXT, TEXT, BOOLEAN, TEXT, TEXT)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_workouts(
  p_user_id UUID,
  p_workout_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.get_is_admin()) THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = p_user_id AND NOT profile.is_admin AND NOT profile.is_blocked
  ) THEN
    RAISE EXCEPTION 'athlete is unavailable' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_workout_ids, '{}'::UUID[])) requested(workout_id)
    LEFT JOIN public.workouts workout ON workout.id = requested.workout_id
    WHERE workout.id IS NULL OR workout.source <> 'coach' OR NOT workout.is_active
  ) THEN
    RAISE EXCEPTION 'assignment includes an unavailable workout' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.user_workouts WHERE user_id = p_user_id;
  INSERT INTO public.user_workouts (user_id, workout_id)
  SELECT p_user_id, requested.workout_id
  FROM (
    SELECT DISTINCT workout_id
    FROM unnest(COALESCE(p_workout_ids, '{}'::UUID[])) requested(workout_id)
  ) requested;

  RETURN p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_workouts(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_workouts(UUID, UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION private.admin_set_user_meal_plan(
  p_user_id UUID,
  p_meal_plan_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.get_is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = p_user_id AND NOT profile.is_admin AND NOT profile.is_blocked
  ) THEN
    RAISE EXCEPTION 'athlete is unavailable' USING ERRCODE = '22023';
  END IF;
  IF p_meal_plan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.meal_plans plan
    WHERE plan.id = p_meal_plan_id AND plan.origin = 'manual' AND plan.is_active
  ) THEN
    RAISE EXCEPTION 'meal plan is unavailable' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 1));

  UPDATE public.meal_plans generated_plan
  SET generation_status = 'superseded'
  WHERE generated_plan.origin = 'generated'
    AND generated_plan.generation_status IN ('generating', 'draft', 'published')
    AND EXISTS (
      SELECT 1 FROM public.user_meal_plans assignment
      WHERE assignment.user_id = p_user_id
        AND assignment.meal_plan_id = generated_plan.id
        AND assignment.status = 'current'
    );

  UPDATE public.user_meal_plans
  SET status = 'superseded', effective_to = now()
  WHERE user_id = p_user_id AND status = 'current';

  IF p_meal_plan_id IS NOT NULL THEN
    INSERT INTO public.user_meal_plans (
      user_id, meal_plan_id, assigned_at, status, effective_from, effective_to
    ) VALUES (
      p_user_id, p_meal_plan_id, now(), 'current', now(), NULL
    )
    ON CONFLICT (user_id, meal_plan_id) DO UPDATE
    SET assigned_at = EXCLUDED.assigned_at,
        status = 'current',
        effective_from = EXCLUDED.effective_from,
        effective_to = NULL;
  END IF;

  RETURN p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_set_user_meal_plan(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.admin_set_user_meal_plan(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_user_meal_plan(
  p_user_id UUID,
  p_meal_plan_id UUID
)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_set_user_meal_plan(p_user_id, p_meal_plan_id)
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_meal_plan(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_meal_plan(UUID, UUID) TO authenticated;
