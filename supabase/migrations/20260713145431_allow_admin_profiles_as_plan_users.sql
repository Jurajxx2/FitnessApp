-- Admin accounts can also use the athlete workspace. Keep administrative
-- authorization separate from whether a profile may receive workout and meal
-- plan assignments.

-- ---------------------------------------------------------------------------
-- Workout editor: preserve the deployed atomic editor and extend assignments
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.admin_save_workout(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, JSONB, UUID[]
) SET SCHEMA private;

ALTER FUNCTION private.admin_save_workout(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, JSONB, UUID[]
) RENAME TO admin_save_workout_base;

REVOKE ALL ON FUNCTION private.admin_save_workout_base(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, JSONB, UUID[]
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.admin_save_workout_with_user_assignments(
  p_workout_id UUID,
  p_name TEXT,
  p_day_of_week INTEGER,
  p_notes TEXT,
  p_is_active BOOLEAN,
  p_exercises JSONB,
  p_assigned_user_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved_workout_id UUID;
  non_admin_user_ids UUID[];
BEGIN
  IF NOT private.get_is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_assigned_user_ids, '{}'::UUID[])) requested(user_id)
    LEFT JOIN public.profiles profile ON profile.id = requested.user_id
    WHERE profile.id IS NULL
      OR (
        profile.is_blocked
        AND NOT EXISTS (
          SELECT 1
          FROM public.user_workouts existing
          WHERE existing.workout_id = p_workout_id
            AND existing.user_id = requested.user_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'assignments include an unavailable user' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT requested.user_id), '{}'::UUID[])
  INTO non_admin_user_ids
  FROM unnest(COALESCE(p_assigned_user_ids, '{}'::UUID[])) requested(user_id)
  JOIN public.profiles profile ON profile.id = requested.user_id
  WHERE NOT profile.is_admin;

  saved_workout_id := private.admin_save_workout_base(
    p_workout_id,
    p_name,
    p_day_of_week,
    p_notes,
    p_is_active,
    p_exercises,
    non_admin_user_ids
  );

  -- The base editor has already removed assignments absent from its filtered
  -- list, including previous admin assignments. Add back the selected admins.
  INSERT INTO public.user_workouts (workout_id, user_id)
  SELECT saved_workout_id, requested.user_id
  FROM (
    SELECT DISTINCT requested_id AS user_id
    FROM unnest(COALESCE(p_assigned_user_ids, '{}'::UUID[])) requested(requested_id)
    JOIN public.profiles profile ON profile.id = requested.requested_id
    WHERE profile.is_admin
  ) requested
  ON CONFLICT (user_id, workout_id) DO NOTHING;

  RETURN saved_workout_id;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_save_workout_with_user_assignments(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, JSONB, UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.admin_save_workout_with_user_assignments(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, JSONB, UUID[]
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_save_workout(
  p_workout_id UUID,
  p_name TEXT,
  p_day_of_week INTEGER,
  p_notes TEXT,
  p_is_active BOOLEAN,
  p_exercises JSONB,
  p_assigned_user_ids UUID[]
)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_save_workout_with_user_assignments(
    p_workout_id, p_name, p_day_of_week, p_notes, p_is_active,
    p_exercises, p_assigned_user_ids
  )
$$;

REVOKE ALL ON FUNCTION public.admin_save_workout(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, JSONB, UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_workout(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, JSONB, UUID[]
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Meal-plan editor: preserve atomic saves and add admin assignment lifecycle
-- ---------------------------------------------------------------------------

ALTER FUNCTION private.admin_save_manual_meal_plan(
  UUID, TEXT, TEXT, JSONB, UUID[], UUID[]
) RENAME TO admin_save_manual_meal_plan_base;

REVOKE ALL ON FUNCTION private.admin_save_manual_meal_plan_base(
  UUID, TEXT, TEXT, JSONB, UUID[], UUID[]
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.admin_save_manual_meal_plan(
  p_plan_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_meals JSONB,
  p_preserved_meal_ids UUID[],
  p_assigned_user_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved_plan_id UUID;
  non_admin_user_ids UUID[];
  admin_user_ids UUID[];
BEGIN
  IF NOT private.get_is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_assigned_user_ids, '{}'::UUID[])) requested(user_id)
    LEFT JOIN public.profiles profile ON profile.id = requested.user_id
    WHERE profile.id IS NULL
      OR (
        profile.is_blocked
        AND NOT EXISTS (
          SELECT 1
          FROM public.user_meal_plans existing
          WHERE existing.meal_plan_id = p_plan_id
            AND existing.user_id = requested.user_id
            AND existing.status = 'current'
        )
      )
  ) THEN
    RAISE EXCEPTION 'assignments include an unavailable user' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT requested.user_id) FILTER (WHERE NOT profile.is_admin), '{}'::UUID[]),
         COALESCE(array_agg(DISTINCT requested.user_id) FILTER (WHERE profile.is_admin), '{}'::UUID[])
  INTO non_admin_user_ids, admin_user_ids
  FROM unnest(COALESCE(p_assigned_user_ids, '{}'::UUID[])) requested(user_id)
  JOIN public.profiles profile ON profile.id = requested.user_id;

  -- Acquire every user lock the base function or the admin reconciliation may
  -- need, in one stable order, before either starts changing current plans.
  PERFORM pg_advisory_xact_lock(hashtextextended(locked_user.user_id::TEXT, 1))
  FROM (
    SELECT DISTINCT requested.user_id
    FROM unnest(COALESCE(p_assigned_user_ids, '{}'::UUID[])) requested(user_id)
    UNION
    SELECT assignment.user_id
    FROM public.user_meal_plans assignment
    WHERE assignment.meal_plan_id = p_plan_id
      AND assignment.status = 'current'
  ) locked_user
  ORDER BY locked_user.user_id;

  saved_plan_id := private.admin_save_manual_meal_plan_base(
    p_plan_id,
    p_name,
    p_description,
    p_meals,
    p_preserved_meal_ids,
    non_admin_user_ids
  );

  UPDATE public.meal_plans generated_plan
  SET generation_status = 'superseded'
  WHERE generated_plan.origin = 'generated'
    AND generated_plan.generation_status IN ('generating', 'draft', 'published')
    AND EXISTS (
      SELECT 1
      FROM public.user_meal_plans current_assignment
      WHERE current_assignment.meal_plan_id = generated_plan.id
        AND current_assignment.status = 'current'
        AND current_assignment.user_id = ANY(admin_user_ids)
        AND current_assignment.meal_plan_id <> saved_plan_id
    );

  UPDATE public.user_meal_plans assignment
  SET status = 'superseded', effective_to = now()
  WHERE assignment.status = 'current'
    AND assignment.user_id = ANY(admin_user_ids);

  INSERT INTO public.user_meal_plans (
    user_id, meal_plan_id, assigned_at, status, effective_from, effective_to
  )
  SELECT requested.user_id, saved_plan_id, now(), 'current', now(), NULL
  FROM unnest(admin_user_ids) requested(user_id)
  ON CONFLICT (user_id, meal_plan_id) DO UPDATE
  SET assigned_at = EXCLUDED.assigned_at,
      status = 'current',
      effective_from = EXCLUDED.effective_from,
      effective_to = NULL;

  RETURN saved_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_save_manual_meal_plan(
  UUID, TEXT, TEXT, JSONB, UUID[], UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.admin_save_manual_meal_plan(
  UUID, TEXT, TEXT, JSONB, UUID[], UUID[]
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- User-detail operations now accept any existing, unblocked profile
-- ---------------------------------------------------------------------------

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
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user % does not exist', p_user_id USING ERRCODE = 'P0002';
  END IF;
  RETURN p_user_id;
END;
$$;

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
    WHERE profile.id = p_user_id AND NOT profile.is_blocked
  ) THEN
    RAISE EXCEPTION 'user is unavailable' USING ERRCODE = '22023';
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
    WHERE profile.id = p_user_id AND NOT profile.is_blocked
  ) THEN
    RAISE EXCEPTION 'user is unavailable' USING ERRCODE = '22023';
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
