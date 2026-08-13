-- Prerequisite schema for audited administrator account operations.
-- This migration does not enforce MFA and can be applied before the Edge
-- Functions are deployed. Final enforcement remains a gated activation
-- template outside the migrations directory.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TABLE public.admin_security_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL,
  target_user_id UUID,
  action TEXT NOT NULL CHECK (action IN (
    'invite_user',
    'block',
    'unblock',
    'promote_admin',
    'delete'
  )),
  outcome TEXT NOT NULL CHECK (outcome IN ('attempt', 'success', 'failure')),
  request_id TEXT NOT NULL CHECK (
    request_id = btrim(request_id)
    AND char_length(request_id) BETWEEN 1 AND 128
  ),
  job_id UUID,
  detail JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (
    jsonb_typeof(detail) = 'object'
    AND octet_length(detail::TEXT) <= 4096
  ),
  response_status SMALLINT,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_security_audit_terminal_response CHECK (
    (
      outcome = 'attempt'
      AND response_status IS NULL
      AND response_body IS NULL
    ) OR (
      outcome IN ('success', 'failure')
      AND response_status IS NOT NULL
      AND response_body IS NOT NULL
      AND response_status BETWEEN 200 AND 599
      AND jsonb_typeof(response_body) = 'object'
      AND octet_length(response_body::TEXT) <= 4096
    )
  )
);

COMMENT ON TABLE public.admin_security_audit IS
  'Append-only service-role audit of administrator account actions.';
COMMENT ON COLUMN public.admin_security_audit.actor_user_id IS
  'Immutable actor UUID snapshot. Intentionally has no FK so account deletion preserves the audit.';
COMMENT ON COLUMN public.admin_security_audit.target_user_id IS
  'Immutable target UUID snapshot. Intentionally has no FK so account deletion preserves the audit.';
COMMENT ON COLUMN public.admin_security_audit.detail IS
  'Sanitized machine-readable reason codes only; never store tokens, email addresses, names, or raw errors.';
COMMENT ON COLUMN public.admin_security_audit.response_body IS
  'Exact sanitized response replay body; never store email addresses, names, tokens, request bodies, or raw errors.';

ALTER TABLE public.admin_security_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_security_audit FORCE ROW LEVEL SECURITY;

-- A caller-supplied request id is the idempotency key. Exactly one durable
-- attempt may exist for an actor/action/request tuple, and exactly one terminal
-- result may follow it. This prevents browser retries from repeating a
-- privileged mutation after an ambiguous response.
CREATE UNIQUE INDEX admin_security_audit_one_attempt_per_request
  ON public.admin_security_audit (actor_user_id, action, request_id)
  WHERE outcome = 'attempt';

CREATE UNIQUE INDEX admin_security_audit_one_result_per_request
  ON public.admin_security_audit (actor_user_id, action, request_id)
  WHERE outcome IN ('success', 'failure');

REVOKE ALL ON TABLE public.admin_security_audit
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.admin_security_audit TO service_role;

CREATE OR REPLACE FUNCTION private.reject_admin_security_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'admin security audit rows are immutable'
    USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION private.reject_admin_security_audit_mutation()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER reject_admin_security_audit_update_or_delete
  BEFORE UPDATE OR DELETE ON public.admin_security_audit
  FOR EACH ROW EXECUTE FUNCTION private.reject_admin_security_audit_mutation();

CREATE OR REPLACE FUNCTION private.enforce_admin_security_audit_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.outcome IN ('success', 'failure') AND NOT EXISTS (
    SELECT 1
    FROM public.admin_security_audit AS audit
    WHERE audit.actor_user_id = NEW.actor_user_id
      AND audit.action = NEW.action
      AND audit.request_id = NEW.request_id
      AND audit.outcome = 'attempt'
  ) THEN
    RAISE EXCEPTION 'terminal admin audit result requires a durable attempt'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_admin_security_audit_sequence()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER enforce_admin_security_audit_insert_sequence
  BEFORE INSERT ON public.admin_security_audit
  FOR EACH ROW EXECUTE FUNCTION private.enforce_admin_security_audit_sequence();

-- Keep the target-role check and profile mutation in one database transaction.
-- The row lock prevents an account from being promoted between a preflight
-- read and a later block/unblock/promote write. Auth deletion is deliberately
-- absent; the following staged deletion-job rollout owns that operation.
CREATE OR REPLACE FUNCTION public.admin_apply_profile_account_action(
  p_user_id UUID,
  p_action TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_is_admin BOOLEAN;
BEGIN
  IF p_action NOT IN ('block', 'unblock', 'promote_admin') THEN
    RETURN 'invalid_action';
  END IF;

  SELECT profile.is_admin
  INTO target_is_admin
  FROM public.profiles AS profile
  WHERE profile.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'target_not_found';
  END IF;
  IF target_is_admin THEN
    RETURN 'admin_target_denied';
  END IF;

  UPDATE public.profiles AS profile
  SET
    is_admin = CASE
      WHEN p_action = 'promote_admin' THEN true
      ELSE profile.is_admin
    END,
    is_blocked = CASE
      WHEN p_action = 'block' THEN true
      WHEN p_action IN ('unblock', 'promote_admin') THEN false
      ELSE profile.is_blocked
    END
  WHERE profile.id = p_user_id
    AND NOT profile.is_admin;

  IF NOT FOUND THEN
    RETURN 'target_changed';
  END IF;
  RETURN 'updated';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_apply_profile_account_action(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_profile_account_action(UUID, TEXT)
  TO service_role;
