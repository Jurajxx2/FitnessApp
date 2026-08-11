-- Workout plans and their exercises are application data, not a public
-- catalogue.  Keep every existing signed-in access path while removing the
-- implicit PUBLIC role from the two legacy SELECT policies.
--
-- Modern assignments live in public.user_workouts.  This lookup is
-- non-recursive: user_workouts policies depend on auth/profile helpers, but do
-- not query workouts or workout_exercises.  Its existing unique
-- (user_id, workout_id) index supports the policy lookup.

DROP POLICY IF EXISTS "Users can read assigned workouts" ON public.workouts;
CREATE POLICY "Users can read assigned workouts"
  ON public.workouts
  FOR SELECT
  TO authenticated
  USING (
    (user_id IS NULL AND source = 'coach' AND is_active IS TRUE)
    OR (SELECT auth.uid()) = user_id
    OR (SELECT auth.uid()) = owner_user_id
    OR EXISTS (
      SELECT 1
      FROM public.user_workouts AS assignment
      WHERE assignment.user_id = (SELECT auth.uid())
        AND assignment.workout_id = workouts.id
    )
  );

DROP POLICY IF EXISTS "Users can read exercises for accessible workouts"
  ON public.workout_exercises;
CREATE POLICY "Users can read exercises for accessible workouts"
  ON public.workout_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workouts AS workout
      WHERE workout.id = workout_exercises.workout_id
        AND (
          (workout.user_id IS NULL
            AND workout.source = 'coach'
            AND workout.is_active IS TRUE)
          OR workout.user_id = (SELECT auth.uid())
          OR workout.owner_user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.user_workouts AS assignment
            WHERE assignment.user_id = (SELECT auth.uid())
              AND assignment.workout_id = workout.id
          )
        )
    )
  );
