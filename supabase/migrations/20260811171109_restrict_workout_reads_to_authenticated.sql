-- Workout plans are visible only after authentication. Keep the existing
-- product contract intact for signed-in users: active/global coach plans,
-- explicit assignments, user-owned plans, and the separate admin policies.

DROP POLICY IF EXISTS "Users can read assigned workouts" ON public.workouts;
CREATE POLICY "Users can read assigned workouts"
  ON public.workouts FOR SELECT TO authenticated
  USING (
    (user_id IS NULL AND source = 'coach' AND is_active)
    OR (SELECT auth.uid()) = user_id
    OR (SELECT auth.uid()) = owner_user_id
  );

DROP POLICY IF EXISTS "Users can read exercises for accessible workouts"
  ON public.workout_exercises;
CREATE POLICY "Users can read exercises for accessible workouts"
  ON public.workout_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workouts AS workout
      WHERE workout.id = workout_id
        AND (
          (workout.user_id IS NULL AND workout.source = 'coach' AND workout.is_active)
          OR workout.user_id = (SELECT auth.uid())
          OR workout.owner_user_id = (SELECT auth.uid())
        )
    )
  );
