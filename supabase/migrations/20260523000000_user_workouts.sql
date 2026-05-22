CREATE TABLE user_workouts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, workout_id)
);

ALTER TABLE user_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own workout assignments"
  ON user_workouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage workout assignments"
  ON user_workouts FOR ALL
  TO authenticated
  USING (get_is_admin())
  WITH CHECK (get_is_admin());

CREATE INDEX idx_user_workouts_user    ON user_workouts(user_id);
CREATE INDEX idx_user_workouts_workout ON user_workouts(workout_id);
