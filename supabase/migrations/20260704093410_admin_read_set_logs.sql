-- Allow admins to inspect user logs from the web admin.
DROP POLICY IF EXISTS "Admin can read all workout logs" ON workout_logs;
CREATE POLICY "Admin can read all workout logs"
  ON workout_logs FOR SELECT TO authenticated
  USING (get_is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can read all exercise logs" ON exercise_logs;
CREATE POLICY "Admin can read all exercise logs"
  ON exercise_logs FOR SELECT TO authenticated
  USING (
    get_is_admin() OR EXISTS (
      SELECT 1
      FROM workout_logs wl
      WHERE wl.id = workout_log_id
        AND wl.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin can read all set logs" ON set_logs;
CREATE POLICY "Admin can read all set logs"
  ON set_logs FOR SELECT TO authenticated
  USING (
    get_is_admin() OR EXISTS (
      SELECT 1
      FROM exercise_logs el
      JOIN workout_logs wl ON wl.id = el.workout_log_id
      WHERE el.id = exercise_log_id
        AND wl.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin can read all meal logs" ON meal_logs;
CREATE POLICY "Admin can read all meal logs"
  ON meal_logs FOR SELECT TO authenticated
  USING (get_is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can read all meal log foods" ON meal_log_foods;
CREATE POLICY "Admin can read all meal log foods"
  ON meal_log_foods FOR SELECT TO authenticated
  USING (
    get_is_admin() OR EXISTS (
      SELECT 1
      FROM meal_logs ml
      WHERE ml.id = meal_log_id
        AND ml.user_id = auth.uid()
    )
  );

-- Meal photo logging writes this field from the app; keep migrations in sync.
ALTER TABLE meal_logs
  ADD COLUMN IF NOT EXISTS image_url TEXT;
