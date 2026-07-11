-- supabase/migrations/20260710113343_fix_check_in_reminder_cron_auth.sql
-- Fix weekly-checkin-reminder cron job: the original job read
-- app.settings.project_url / app.settings.service_role_key via current_setting(),
-- but ALTER DATABASE ... SET is not permitted on hosted Supabase projects
-- (42501 permission denied) without a Support-granted exception.
--
-- Fix: call the function with the anon (publishable) key instead of the
-- service role key. The Edge Functions gateway only needs a valid signed JWT
-- to pass verify_jwt; the function does its own privileged DB access via its
-- auto-injected SUPABASE_SERVICE_ROLE_KEY. The anon key is public by design
-- (already shipped in the mobile app bundle), so it's safe to inline here.

SELECT cron.unschedule('weekly-checkin-reminder')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-checkin-reminder');

SELECT cron.schedule(
  'weekly-checkin-reminder',
  '0 17 * * 0',  -- Sundays 17:00 UTC
  $$
  SELECT net.http_post(
    url     := 'https://nsrhhvwytusltnikqplk.supabase.co/functions/v1/weekly-checkin-reminder',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zcmhodnd5dHVzbHRuaWtxcGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTU3ODIsImV4cCI6MjA4Nzg5MTc4Mn0.HOmwk1ry3kCN00QePqj9ELyPsjzWFF6fzTYg5a_UEw8'
               ),
    body    := '{}'::jsonb
  );
  $$
);
