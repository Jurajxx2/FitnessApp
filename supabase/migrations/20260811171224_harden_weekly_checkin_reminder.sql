-- Authenticate the cron caller with a dedicated secret, then make weekly runs
-- and per-recipient delivery attempts race-safe and observable. The tables live
-- outside the exposed API schema; only service_role can use the narrow public
-- wrappers below.

GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE private.weekly_checkin_reminder_runs (
  week_of          DATE PRIMARY KEY,
  attempt_id       UUID NOT NULL DEFAULT gen_random_uuid(),
  status           TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  attempt_count    INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 3),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finished_at      TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  last_error_code  TEXT CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 80)
);

ALTER TABLE private.weekly_checkin_reminder_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.weekly_checkin_reminder_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.weekly_checkin_reminder_runs TO service_role;

CREATE TABLE private.weekly_checkin_reminder_deliveries (
  week_of          DATE NOT NULL REFERENCES private.weekly_checkin_reminder_runs(week_of),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'claimed'
                     CHECK (status IN ('claimed', 'sent', 'no_tokens', 'send_failed')),
  claimed_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finished_at      TIMESTAMPTZ,
  last_error_code  TEXT CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 80),
  PRIMARY KEY (week_of, user_id)
);

CREATE INDEX weekly_checkin_deliveries_user_week
  ON private.weekly_checkin_reminder_deliveries(user_id, week_of DESC);

ALTER TABLE private.weekly_checkin_reminder_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.weekly_checkin_reminder_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.weekly_checkin_reminder_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_weekly_checkin_reminder_run(p_week_of DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  reservation_time TIMESTAMPTZ := clock_timestamp();
  current_run private.weekly_checkin_reminder_runs%ROWTYPE;
  next_attempt_id UUID := gen_random_uuid();
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_week_of IS NULL THEN
    RAISE EXCEPTION 'week is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('weekly_checkin_reminder:' || p_week_of::TEXT, 0)
  );

  SELECT * INTO current_run
  FROM private.weekly_checkin_reminder_runs
  WHERE week_of = p_week_of;

  IF NOT FOUND THEN
    INSERT INTO private.weekly_checkin_reminder_runs(week_of, attempt_id, status)
    VALUES (p_week_of, next_attempt_id, 'running');
    RETURN pg_catalog.jsonb_build_object('status', 'reserved', 'attempt_id', next_attempt_id);
  END IF;

  IF current_run.status = 'succeeded' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'already_succeeded');
  END IF;
  IF current_run.status = 'running'
     AND current_run.started_at > reservation_time - INTERVAL '15 minutes' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'in_progress');
  END IF;
  IF current_run.attempt_count >= 3 THEN
    RETURN pg_catalog.jsonb_build_object('status', 'exhausted');
  END IF;
  IF current_run.status = 'failed'
     AND current_run.updated_at > reservation_time - INTERVAL '15 minutes' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'cooldown');
  END IF;

  UPDATE private.weekly_checkin_reminder_runs
  SET attempt_id = next_attempt_id,
      status = 'running',
      attempt_count = attempt_count + 1,
      started_at = reservation_time,
      finished_at = NULL,
      updated_at = reservation_time,
      last_error_code = NULL
  WHERE week_of = p_week_of;

  RETURN pg_catalog.jsonb_build_object('status', 'reserved', 'attempt_id', next_attempt_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_weekly_checkin_reminder_run(
  p_week_of DATE,
  p_attempt_id UUID,
  p_status TEXT,
  p_error_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('succeeded', 'failed')
     OR (p_error_code IS NOT NULL AND char_length(p_error_code) > 80) THEN
    RAISE EXCEPTION 'invalid completion' USING ERRCODE = '22023';
  END IF;

  UPDATE private.weekly_checkin_reminder_runs
  SET status = p_status,
      finished_at = clock_timestamp(),
      updated_at = clock_timestamp(),
      last_error_code = CASE WHEN p_status = 'failed' THEN p_error_code ELSE NULL END
  WHERE week_of = p_week_of
    AND attempt_id = p_attempt_id
    AND status = 'running';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_weekly_checkin_reminder_delivery(
  p_week_of DATE,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_week_of IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'week and user are required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.weekly_checkin_reminder_deliveries(week_of, user_id)
  VALUES (p_week_of, p_user_id)
  ON CONFLICT (week_of, user_id) DO NOTHING;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_weekly_checkin_reminder_delivery(
  p_week_of DATE,
  p_user_id UUID,
  p_status TEXT,
  p_error_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('sent', 'no_tokens', 'send_failed')
     OR (p_error_code IS NOT NULL AND char_length(p_error_code) > 80) THEN
    RAISE EXCEPTION 'invalid delivery completion' USING ERRCODE = '22023';
  END IF;

  UPDATE private.weekly_checkin_reminder_deliveries
  SET status = p_status,
      finished_at = clock_timestamp(),
      last_error_code = p_error_code
  WHERE week_of = p_week_of
    AND user_id = p_user_id
    AND status = 'claimed';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_weekly_checkin_reminder_run(DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_weekly_checkin_reminder_run(DATE, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_weekly_checkin_reminder_delivery(DATE, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_weekly_checkin_reminder_delivery(DATE, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_weekly_checkin_reminder_run(DATE),
  public.complete_weekly_checkin_reminder_run(DATE, UUID, TEXT, TEXT),
  public.claim_weekly_checkin_reminder_delivery(DATE, UUID),
  public.record_weekly_checkin_reminder_delivery(DATE, UUID, TEXT, TEXT)
  TO service_role;

-- The matching value must be provisioned separately as both the Edge Function
-- secret WEEKLY_CHECKIN_CRON_SECRET and Vault secret weekly_checkin_cron_secret.
-- Keeping the secret lookup inside the scheduled command avoids persisting the
-- decrypted value in cron.job.
SELECT cron.unschedule('weekly-checkin-reminder')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-checkin-reminder');

SELECT cron.schedule(
  'weekly-checkin-reminder',
  '0 17 * * 0',
  $schedule$
  SELECT net.http_post(
    url := 'https://nsrhhvwytusltnikqplk.supabase.co/functions/v1/weekly-checkin-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets
         WHERE name = 'weekly_checkin_cron_secret' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $schedule$
);
