-- A workout log is historical data. The plan may be removed after it is logged,
-- so keep the log (and its dependent exercise/set logs) while clearing only the
-- optional reference to the removed plan.
ALTER TABLE public.workout_logs
  DROP CONSTRAINT workout_logs_workout_id_fkey,
  ADD CONSTRAINT workout_logs_workout_id_fkey
    FOREIGN KEY (workout_id) REFERENCES public.workouts(id) ON DELETE SET NULL;
