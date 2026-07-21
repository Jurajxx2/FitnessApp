-- Persist whether workout duration follows the structure-derived estimate or
-- an explicit coach/athlete override. Existing user-owned workouts came from a
-- required manual duration field, so preserve that intent during backfill.
ALTER TABLE public.workouts
  ADD COLUMN duration_mode TEXT NOT NULL DEFAULT 'auto'
  CONSTRAINT workouts_duration_mode_check CHECK (duration_mode IN ('auto', 'manual'));

UPDATE public.workouts
SET duration_mode = 'manual'
WHERE source = 'user'
   OR duration_minutes > 0;

-- Coach workouts created by the previous admin RPC defaulted to zero minutes.
-- Give those existing plans the same conservative structure-based baseline as
-- the new UI (40 seconds per set, prescribed inter-set rest, five-minute warmup,
-- and 90 seconds between exercises), rounded up to five minutes.
WITH workout_totals AS (
  SELECT
    workout_id,
    count(*) AS exercise_count,
    sum(
      greatest(sets, 1) * 40
      + greatest(sets - 1, 0) * greatest(rest_seconds, 0)
    ) AS exercise_seconds
  FROM public.workout_exercises
  GROUP BY workout_id
)
UPDATE public.workouts workout
SET duration_minutes = least(
      360,
      greatest(
        10,
        ceil((300 + greatest(totals.exercise_count - 1, 0) * 90 + totals.exercise_seconds) / 300.0)::INTEGER * 5
      )
    ),
    updated_at = now()
FROM workout_totals totals
WHERE workout.id = totals.workout_id
  AND workout.source = 'coach'
  AND workout.duration_minutes <= 0;

COMMENT ON COLUMN public.workouts.duration_mode IS
  'Whether duration_minutes is structure-derived (auto) or explicitly overridden (manual).';

-- Keep the old public.admin_save_workout during rollout so the currently
-- deployed admin remains functional until the v2 frontend is live. This is a
-- distinct function name rather than an overload because PostgREST does not
-- support overloaded RPC functions reliably.
CREATE OR REPLACE FUNCTION private.admin_save_workout_with_user_assignments_v2(
  p_workout_id UUID,
  p_name TEXT,
  p_day_of_week INTEGER,
  p_notes TEXT,
  p_is_active BOOLEAN,
  p_duration_minutes INTEGER,
  p_duration_mode TEXT,
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
  IF p_duration_minutes IS NULL OR p_duration_minutes NOT BETWEEN 5 AND 360 THEN
    RAISE EXCEPTION 'duration_minutes must be between 5 and 360' USING ERRCODE = '22023';
  END IF;
  IF p_duration_mode IS NULL OR p_duration_mode NOT IN ('auto', 'manual') THEN
    RAISE EXCEPTION 'duration_mode must be auto or manual' USING ERRCODE = '22023';
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

  UPDATE public.workouts
  SET duration_minutes = p_duration_minutes,
      duration_mode = p_duration_mode,
      updated_at = now()
  WHERE id = saved_workout_id
    AND source = 'coach';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'coach workout % does not exist', saved_workout_id
      USING ERRCODE = 'P0002';
  END IF;

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

REVOKE ALL ON FUNCTION private.admin_save_workout_with_user_assignments_v2(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, INTEGER, TEXT, JSONB, UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.admin_save_workout_with_user_assignments_v2(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, INTEGER, TEXT, JSONB, UUID[]
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_save_workout_v2(
  p_workout_id UUID,
  p_name TEXT,
  p_day_of_week INTEGER,
  p_notes TEXT,
  p_is_active BOOLEAN,
  p_duration_minutes INTEGER,
  p_duration_mode TEXT,
  p_exercises JSONB,
  p_assigned_user_ids UUID[]
)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_save_workout_with_user_assignments_v2(
    p_workout_id, p_name, p_day_of_week, p_notes, p_is_active,
    p_duration_minutes, p_duration_mode, p_exercises, p_assigned_user_ids
  )
$$;

REVOKE ALL ON FUNCTION public.admin_save_workout_v2(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, INTEGER, TEXT, JSONB, UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_workout_v2(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, INTEGER, TEXT, JSONB, UUID[]
) TO authenticated;
