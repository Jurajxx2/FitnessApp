-- AI access is an explicit entitlement. It is deliberately not inferred from
-- nutrition/activity access, and existing users fail closed until an admin or
-- service-role workflow explicitly enables it.
ALTER TABLE public.profiles
  ADD COLUMN ai_access_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.protect_profile_ai_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.ai_access_enabled IS NOT DISTINCT FROM OLD.ai_access_enabled THEN
    RETURN NEW;
  END IF;
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT private.get_is_admin() THEN
    RAISE EXCEPTION 'AI access can only be changed by an admin'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_profile_ai_access() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER protect_profile_ai_access
  BEFORE UPDATE OF ai_access_enabled ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.protect_profile_ai_access();

GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE private.ai_proxy_quota_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  input_chars         INTEGER NOT NULL CHECK (input_chars BETWEEN 1 AND 20000),
  reserved_max_tokens INTEGER NOT NULL CHECK (reserved_max_tokens BETWEEN 1 AND 768),
  status              TEXT NOT NULL DEFAULT 'reserved'
                        CHECK (status IN ('reserved', 'upstream_accepted', 'upstream_failed')),
  finished_at         TIMESTAMPTZ,
  upstream_status     INTEGER CHECK (upstream_status IS NULL OR upstream_status BETWEEN 100 AND 599)
);

CREATE INDEX ai_proxy_quota_user_requested
  ON private.ai_proxy_quota_events(user_id, requested_at DESC);
CREATE INDEX ai_proxy_quota_requested
  ON private.ai_proxy_quota_events(requested_at DESC);

ALTER TABLE private.ai_proxy_quota_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ai_proxy_quota_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.ai_proxy_quota_events TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_proxy_quota(
  p_user_id UUID,
  p_input_chars INTEGER,
  p_max_output_tokens INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  reservation_time TIMESTAMPTZ := clock_timestamp();
  reservation_id UUID := gen_random_uuid();
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_input_chars NOT BETWEEN 1 AND 20000
     OR p_max_output_tokens NOT BETWEEN 1 AND 768 THEN
    RAISE EXCEPTION 'invalid quota reservation' USING ERRCODE = '22023';
  END IF;

  -- Always take the global lock before the user lock to keep ordering stable.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ai_proxy:global', 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ai_proxy:user:' || p_user_id::TEXT, 0)
  );

  DELETE FROM private.ai_proxy_quota_events
  WHERE requested_at < reservation_time - INTERVAL '30 days';

  IF (
    SELECT count(*)
    FROM private.ai_proxy_quota_events
    WHERE user_id = p_user_id
      AND requested_at >= reservation_time - INTERVAL '1 minute'
  ) >= 5 OR (
    SELECT count(*)
    FROM private.ai_proxy_quota_events
    WHERE user_id = p_user_id
      AND requested_at >= reservation_time - INTERVAL '24 hours'
  ) >= 50 OR COALESCE((
    SELECT sum(reserved_max_tokens)
    FROM private.ai_proxy_quota_events
    WHERE user_id = p_user_id
      AND requested_at >= reservation_time - INTERVAL '24 hours'
  ), 0) + p_max_output_tokens > 38400 OR COALESCE((
    SELECT sum(reserved_max_tokens)
    FROM private.ai_proxy_quota_events
    WHERE requested_at >= reservation_time - INTERVAL '24 hours'
  ), 0) + p_max_output_tokens > 500000 THEN
    RETURN NULL;
  END IF;

  INSERT INTO private.ai_proxy_quota_events(
    id, user_id, requested_at, input_chars, reserved_max_tokens
  ) VALUES (
    reservation_id, p_user_id, reservation_time, p_input_chars, p_max_output_tokens
  );

  RETURN reservation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_ai_proxy_quota_outcome(
  p_reservation_id UUID,
  p_status TEXT,
  p_upstream_status INTEGER DEFAULT NULL
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
  IF p_status NOT IN ('upstream_accepted', 'upstream_failed')
     OR (p_upstream_status IS NOT NULL AND p_upstream_status NOT BETWEEN 100 AND 599) THEN
    RAISE EXCEPTION 'invalid quota outcome' USING ERRCODE = '22023';
  END IF;

  UPDATE private.ai_proxy_quota_events
  SET status = p_status,
      finished_at = clock_timestamp(),
      upstream_status = p_upstream_status
  WHERE id = p_reservation_id
    AND status = 'reserved';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_proxy_quota(UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ai_proxy_quota_outcome(UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_proxy_quota(UUID, INTEGER, INTEGER),
  public.record_ai_proxy_quota_outcome(UUID, TEXT, INTEGER)
  TO service_role;
