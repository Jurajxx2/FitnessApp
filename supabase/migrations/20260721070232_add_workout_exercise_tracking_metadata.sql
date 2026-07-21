-- A plan must declare how each movement is logged. A free-text reps column is
-- insufficient for timed movements because clients then have to guess their UI.
ALTER TABLE public.workout_exercises
  ADD COLUMN log_type TEXT,
  ADD COLUMN target_duration_seconds INTEGER;

ALTER TABLE public.workout_exercises
  ADD CONSTRAINT workout_exercises_log_type_check
    CHECK (log_type IS NULL OR log_type IN ('weight_reps', 'bodyweight_reps', 'time')),
  ADD CONSTRAINT workout_exercises_target_duration_check
    CHECK (
      log_type IS NULL
      OR (log_type = 'time' AND target_duration_seconds BETWEEN 1 AND 3600)
      OR (log_type <> 'time' AND target_duration_seconds IS NULL)
    );

-- Keep existing plans untouched: clients fall back to their established
-- name/reps inference when log_type is NULL. New coach plans use the explicit
-- fields through the v3 RPC below.
CREATE OR REPLACE FUNCTION private.apply_workout_exercise_tracking_metadata(
  p_workout_id UUID,
  p_exercises JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_exercises, '[]'::JSONB)) AS exercise(
      sort_order INTEGER, log_type TEXT, target_duration_seconds INTEGER
    )
    WHERE exercise.log_type IS NOT NULL
      AND (
        exercise.log_type NOT IN ('weight_reps', 'bodyweight_reps', 'time')
        OR (exercise.log_type = 'time' AND exercise.target_duration_seconds NOT BETWEEN 1 AND 3600)
        OR (exercise.log_type <> 'time' AND exercise.target_duration_seconds IS NOT NULL)
      )
  ) THEN
    RAISE EXCEPTION 'workout exercise tracking metadata is invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.workout_exercises AS saved
  SET log_type = input.log_type,
      target_duration_seconds = input.target_duration_seconds
  FROM jsonb_to_recordset(COALESCE(p_exercises, '[]'::JSONB)) AS input(
    sort_order INTEGER, log_type TEXT, target_duration_seconds INTEGER
  )
  WHERE saved.workout_id = p_workout_id
    AND saved.sort_order = input.sort_order;
END;
$$;

REVOKE ALL ON FUNCTION private.apply_workout_exercise_tracking_metadata(UUID, JSONB) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.admin_save_workout_with_user_assignments_v3(
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
BEGIN
  saved_workout_id := private.admin_save_workout_with_user_assignments_v2(
    p_workout_id, p_name, p_day_of_week, p_notes, p_is_active,
    p_duration_minutes, p_duration_mode, p_exercises, p_assigned_user_ids
  );
  PERFORM private.apply_workout_exercise_tracking_metadata(saved_workout_id, p_exercises);
  RETURN saved_workout_id;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_save_workout_with_user_assignments_v3(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, INTEGER, TEXT, JSONB, UUID[]
) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_save_workout_v3(
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
  SELECT private.admin_save_workout_with_user_assignments_v3(
    p_workout_id, p_name, p_day_of_week, p_notes, p_is_active,
    p_duration_minutes, p_duration_mode, p_exercises, p_assigned_user_ids
  )
$$;

REVOKE ALL ON FUNCTION public.admin_save_workout_v3(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, INTEGER, TEXT, JSONB, UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_workout_v3(
  UUID, TEXT, INTEGER, TEXT, BOOLEAN, INTEGER, TEXT, JSONB, UUID[]
) TO authenticated;
