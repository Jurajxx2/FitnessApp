-- A user may have one resumable workout session at a time.
DROP INDEX IF EXISTS public.idx_workout_logs_in_progress;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_logs_one_in_progress_per_user
  ON public.workout_logs (user_id)
  WHERE status = 'in_progress';
