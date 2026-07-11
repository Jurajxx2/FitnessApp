-- Coach feedback on completed workout logs or specific exercise logs.
CREATE TABLE workout_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_log_id  UUID REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_log_id UUID REFERENCES exercise_logs(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(btrim(body)) > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workout_feedback_single_target CHECK (
    ((workout_log_id IS NOT NULL)::int + (exercise_log_id IS NOT NULL)::int) = 1
  )
);

CREATE OR REPLACE FUNCTION validate_workout_feedback_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  IF NEW.workout_log_id IS NOT NULL THEN
    SELECT wl.user_id
      INTO target_user_id
      FROM workout_logs wl
      WHERE wl.id = NEW.workout_log_id;
  ELSE
    SELECT wl.user_id
      INTO target_user_id
      FROM exercise_logs el
      JOIN workout_logs wl ON wl.id = el.workout_log_id
      WHERE el.id = NEW.exercise_log_id;
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Feedback target does not exist'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.user_id <> target_user_id THEN
    RAISE EXCEPTION 'Feedback user_id must match the targeted log owner'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_workout_feedback_target_trigger
  BEFORE INSERT OR UPDATE OF user_id, workout_log_id, exercise_log_id
  ON workout_feedback
  FOR EACH ROW EXECUTE FUNCTION validate_workout_feedback_target();

CREATE TRIGGER handle_workout_feedback_updated_at
  BEFORE UPDATE ON workout_feedback
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE workout_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own workout feedback"
  ON workout_feedback FOR SELECT TO authenticated
  USING (get_is_admin() OR auth.uid() = user_id);

CREATE POLICY "Admin can insert workout feedback"
  ON workout_feedback FOR INSERT TO authenticated
  WITH CHECK (get_is_admin() AND coach_id = auth.uid());

CREATE POLICY "Admin can update workout feedback"
  ON workout_feedback FOR UPDATE TO authenticated
  USING (get_is_admin())
  WITH CHECK (get_is_admin());

CREATE POLICY "Admin can delete workout feedback"
  ON workout_feedback FOR DELETE TO authenticated
  USING (get_is_admin());

CREATE INDEX idx_workout_feedback_user_created
  ON workout_feedback(user_id, created_at DESC);

CREATE INDEX idx_workout_feedback_workout_log
  ON workout_feedback(workout_log_id, created_at DESC)
  WHERE workout_log_id IS NOT NULL;

CREATE INDEX idx_workout_feedback_exercise_log
  ON workout_feedback(exercise_log_id, created_at DESC)
  WHERE exercise_log_id IS NOT NULL;
