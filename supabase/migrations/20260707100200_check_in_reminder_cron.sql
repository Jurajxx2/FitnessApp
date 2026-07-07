-- supabase/migrations/20260707100200_check_in_reminder_cron.sql
-- Schedule the weekly-checkin-reminder edge function every Sunday 17:00 UTC.
-- Requires: pg_cron + pg_net, and two DB settings holding the project URL + service key
-- (set during deploy — see 2026-07-07-weekly-check-in-DEPLOY.md). Idempotent.

CREATE EXTENSION IF NOT EXISTS pg_cron  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net   WITH SCHEMA extensions;

-- Remove any previous definition so re-running the migration is safe.
SELECT cron.unschedule('weekly-checkin-reminder')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-checkin-reminder');

SELECT cron.schedule(
  'weekly-checkin-reminder',
  '0 17 * * 0',  -- Sundays 17:00 UTC
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.project_url') || '/functions/v1/weekly-checkin-reminder',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
               ),
    body    := '{}'::jsonb
  );
  $$
);
