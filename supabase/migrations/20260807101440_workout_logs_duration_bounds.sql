-- Bound workout_logs.duration_minutes at the database.
--
-- The 240-minute cap existed only in the web client (MAX_WORKOUT_DURATION_MINUTES in
-- admin/src/activity/api.ts), so a session left running overnight on mobile — or any
-- direct PostgREST write — could record 720 minutes straight into the athlete's totals
-- and the coach's compliance stats. A session that runs past four hours is an athlete
-- who forgot to tap "finish", not a real training block.
--
-- 0 is allowed: rows start at the column default while a session is in_progress.
-- NULL is allowed: the column has always been nullable and nothing depends on it not
-- being, so this migration does not tighten that at the same time.

-- Clamp anything already out of range so the constraint can be added as VALID.
UPDATE workout_logs
SET duration_minutes = 240
WHERE duration_minutes > 240;

UPDATE workout_logs
SET duration_minutes = 0
WHERE duration_minutes < 0;

ALTER TABLE workout_logs
  ADD CONSTRAINT workout_logs_duration_minutes_range
  CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 240);

COMMENT ON CONSTRAINT workout_logs_duration_minutes_range ON workout_logs IS
  'Mirrors the 240-minute client cap so an abandoned session cannot poison progress totals or coach compliance stats.';
