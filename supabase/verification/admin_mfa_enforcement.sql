-- Run only after applying 20260811212458_create_admin_security_audit.sql and a
-- fresh gated migration created from supabase/activation/enforce_admin_mfa.sql.
-- This verifier changes only transaction-local fixtures and rolls them back.

BEGIN;

CREATE TEMP TABLE admin_mfa_checks (
  check_name TEXT PRIMARY KEY,
  passed BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO admin_mfa_checks (check_name, passed)
VALUES
  (
    'central helper is security definer with an empty search path',
    EXISTS (
      SELECT 1
      FROM pg_proc AS procedure_record
      JOIN pg_namespace AS namespace ON namespace.oid = procedure_record.pronamespace
      WHERE namespace.nspname = 'private'
        AND procedure_record.proname = 'get_is_admin'
        AND procedure_record.prosecdef
        AND procedure_record.proconfig = ARRAY['search_path=""']::TEXT[]
        AND pg_get_functiondef(procedure_record.oid) LIKE '%is_admin AND NOT profile.is_blocked%'
        AND pg_get_functiondef(procedure_record.oid) LIKE '%auth.jwt() ->> ''aal''%'
    )
  ),
  (
    'anonymous callers cannot execute either admin helper',
    NOT has_function_privilege('anon', 'private.get_is_admin()', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.get_is_admin()', 'EXECUTE')
  ),
  (
    'exercise mutations use central authority rather than app metadata',
    (
      SELECT count(*) = 2
        AND bool_and(COALESCE(policy.qual, '') NOT LIKE '%app_metadata%')
        AND bool_and(COALESCE(policy.with_check, '') NOT LIKE '%app_metadata%')
        AND bool_and(
          COALESCE(policy.qual, '') LIKE '%get_is_admin%'
          OR COALESCE(policy.with_check, '') LIKE '%get_is_admin%'
        )
      FROM pg_policies AS policy
      WHERE policy.schemaname = 'public'
        AND policy.tablename = 'exercises'
        AND policy.policyname IN ('admin insert exercises', 'admin update exercises')
    )
  ),
  (
    'audit table is RLS protected and service role is append only',
    EXISTS (
      SELECT 1
      FROM pg_class AS relation
      WHERE relation.oid = 'public.admin_security_audit'::regclass
        AND relation.relrowsecurity
        AND relation.relforcerowsecurity
    )
      AND has_table_privilege('service_role', 'public.admin_security_audit', 'SELECT')
      AND has_table_privilege('service_role', 'public.admin_security_audit', 'INSERT')
      AND NOT has_table_privilege('service_role', 'public.admin_security_audit', 'UPDATE')
      AND NOT has_table_privilege('service_role', 'public.admin_security_audit', 'DELETE')
      AND NOT has_table_privilege('service_role', 'public.admin_security_audit', 'TRUNCATE')
      AND NOT has_table_privilege('authenticated', 'public.admin_security_audit', 'SELECT')
      AND NOT has_table_privilege('authenticated', 'public.admin_security_audit', 'INSERT')
      AND NOT has_table_privilege('anon', 'public.admin_security_audit', 'SELECT')
  ),
  (
    'audit actor and target snapshots have no foreign keys',
    NOT EXISTS (
      SELECT 1
      FROM pg_constraint AS constraint_record
      WHERE constraint_record.conrelid = 'public.admin_security_audit'::regclass
        AND constraint_record.contype = 'f'
    )
  ),
  (
    'audit mutation rejection trigger is enabled',
    EXISTS (
      SELECT 1
      FROM pg_trigger AS trigger_record
      WHERE trigger_record.tgrelid = 'public.admin_security_audit'::regclass
        AND trigger_record.tgname = 'reject_admin_security_audit_update_or_delete'
        AND NOT trigger_record.tgisinternal
        AND trigger_record.tgenabled <> 'D'
    )
  ),
  (
    'audit sequencing and idempotency guards are enabled',
    EXISTS (
      SELECT 1
      FROM pg_trigger AS trigger_record
      WHERE trigger_record.tgrelid = 'public.admin_security_audit'::regclass
        AND trigger_record.tgname = 'enforce_admin_security_audit_insert_sequence'
        AND NOT trigger_record.tgisinternal
        AND trigger_record.tgenabled <> 'D'
    )
      AND to_regclass('public.admin_security_audit_one_attempt_per_request') IS NOT NULL
      AND to_regclass('public.admin_security_audit_one_result_per_request') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_record
        WHERE constraint_record.conrelid = 'public.admin_security_audit'::regclass
          AND constraint_record.conname = 'admin_security_audit_terminal_response'
          AND constraint_record.contype = 'c'
      )
  ),
  (
    'atomic profile action RPC is service role only',
    has_function_privilege(
      'service_role',
      'public.admin_apply_profile_account_action(uuid,text)',
      'EXECUTE'
    )
      AND NOT has_function_privilege(
        'authenticated',
        'public.admin_apply_profile_account_action(uuid,text)',
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        'public.admin_apply_profile_account_action(uuid,text)',
        'EXECUTE'
      )
  );

DO $$
DECLARE
  admin_id UUID;
  athlete_id UUID;
  athlete_feature TEXT;
BEGIN
  SELECT profile.id
  INTO admin_id
  FROM public.profiles AS profile
  WHERE profile.is_admin AND NOT profile.is_blocked
  ORDER BY profile.created_at
  LIMIT 1;

  SELECT
    profile.id,
    CASE WHEN profile.access_mode = 'activity' THEN 'activity' ELSE 'nutrition' END
  INTO athlete_id, athlete_feature
  FROM public.profiles AS profile
  WHERE NOT profile.is_admin
    AND NOT profile.is_blocked
    AND profile.access_mode IN ('nutrition', 'activity', 'both')
  ORDER BY profile.created_at
  LIMIT 1;

  IF admin_id IS NULL OR athlete_id IS NULL THEN
    RAISE EXCEPTION 'verifier needs one active admin and one active athlete profile';
  END IF;

  PERFORM set_config('coach_foska.verify_admin_id', admin_id::TEXT, true);
  PERFORM set_config('coach_foska.verify_athlete_id', athlete_id::TEXT, true);
  PERFORM set_config('coach_foska.verify_athlete_feature', athlete_feature, true);
END;
$$;

-- Ordinary athlete at aal2 is not an admin.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('coach_foska.verify_athlete_id'),
    'role', 'authenticated',
    'aal', 'aal2'
  )::TEXT,
  true
);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'coach_foska.verify_athlete_admin',
  public.get_is_admin()::TEXT,
  true
);
RESET ROLE;
INSERT INTO admin_mfa_checks VALUES (
  'aal2 athlete is not an admin',
  current_setting('coach_foska.verify_athlete_admin')::BOOLEAN = false
);

-- Athlete entitlement remains independent of admin MFA authority.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('coach_foska.verify_athlete_id'),
    'role', 'authenticated',
    'aal', 'aal1'
  )::TEXT,
  true
);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'coach_foska.verify_athlete_feature_result',
  private.current_user_has_feature(current_setting('coach_foska.verify_athlete_feature'))::TEXT,
  true
);
RESET ROLE;
INSERT INTO admin_mfa_checks VALUES (
  'aal1 athlete keeps the configured feature entitlement',
  current_setting('coach_foska.verify_athlete_feature_result')::BOOLEAN
);

-- The same active administrator is denied at aal1 and accepted at aal2.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('coach_foska.verify_admin_id'),
    'role', 'authenticated',
    'aal', 'aal1'
  )::TEXT,
  true
);
SET LOCAL ROLE authenticated;
SELECT set_config('coach_foska.verify_admin_aal1', public.get_is_admin()::TEXT, true);
SELECT set_config(
  'coach_foska.verify_admin_aal1_other_profile_visible',
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = current_setting('coach_foska.verify_athlete_id')::UUID
  )::TEXT,
  true
);
RESET ROLE;
INSERT INTO admin_mfa_checks VALUES (
  'aal1 admin is denied',
  current_setting('coach_foska.verify_admin_aal1')::BOOLEAN = false
);
INSERT INTO admin_mfa_checks VALUES (
  'aal1 admin cannot read another profile through admin RLS',
  current_setting('coach_foska.verify_admin_aal1_other_profile_visible')::BOOLEAN = false
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('coach_foska.verify_admin_id'),
    'role', 'authenticated',
    'aal', 'aal2'
  )::TEXT,
  true
);
SET LOCAL ROLE authenticated;
SELECT set_config('coach_foska.verify_admin_aal2', public.get_is_admin()::TEXT, true);
SELECT set_config(
  'coach_foska.verify_admin_aal2_other_profile_visible',
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = current_setting('coach_foska.verify_athlete_id')::UUID
  )::TEXT,
  true
);
RESET ROLE;
INSERT INTO admin_mfa_checks VALUES (
  'aal2 active admin is accepted',
  current_setting('coach_foska.verify_admin_aal2')::BOOLEAN
);
INSERT INTO admin_mfa_checks VALUES (
  'aal2 active admin retains cross-profile RLS access',
  current_setting('coach_foska.verify_admin_aal2_other_profile_visible')::BOOLEAN
);

-- The service role can atomically mutate only a non-admin profile and append
-- ordered audit rows. Every fixture is rolled back.
SET LOCAL ROLE service_role;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.admin_security_audit (
      actor_user_id,
      action,
      outcome,
      request_id,
      response_status,
      response_body
    ) VALUES (
      current_setting('coach_foska.verify_admin_id')::UUID,
      'block',
      'attempt',
      'sql-invalid-attempt-response',
      200,
      '{"unexpected":true}'::JSONB
    );
    RAISE EXCEPTION 'attempt unexpectedly accepted replay fields';
  EXCEPTION WHEN check_violation THEN
    PERFORM set_config('coach_foska.verify_attempt_response_rejected', 'true', true);
  END;
END;
$$;
SELECT set_config(
  'coach_foska.verify_admin_target_denied',
  public.admin_apply_profile_account_action(
    current_setting('coach_foska.verify_admin_id')::UUID,
    'block'
  ),
  true
);
SELECT set_config(
  'coach_foska.verify_athlete_blocked',
  public.admin_apply_profile_account_action(
    current_setting('coach_foska.verify_athlete_id')::UUID,
    'block'
  ),
  true
);
SELECT set_config(
  'coach_foska.verify_athlete_unblocked',
  public.admin_apply_profile_account_action(
    current_setting('coach_foska.verify_athlete_id')::UUID,
    'unblock'
  ),
  true
);
INSERT INTO public.admin_security_audit (
  actor_user_id,
  target_user_id,
  action,
  outcome,
  request_id,
  detail
) VALUES (
  current_setting('coach_foska.verify_admin_id')::UUID,
  current_setting('coach_foska.verify_athlete_id')::UUID,
  'block',
  'attempt',
  'sql-verifier',
  '{"stage":"mutation_requested"}'::JSONB
);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.admin_security_audit (
      actor_user_id,
      target_user_id,
      action,
      outcome,
      request_id,
      detail
    ) VALUES (
      current_setting('coach_foska.verify_admin_id')::UUID,
      current_setting('coach_foska.verify_athlete_id')::UUID,
      'block',
      'success',
      'sql-verifier',
      '{}'::JSONB
    );
    RAISE EXCEPTION 'terminal result unexpectedly accepted without replay fields';
  EXCEPTION WHEN check_violation THEN
    PERFORM set_config('coach_foska.verify_terminal_response_required', 'true', true);
  END;
END;
$$;
INSERT INTO public.admin_security_audit (
  actor_user_id,
  target_user_id,
  action,
  outcome,
  request_id,
  detail,
  response_status,
  response_body
) VALUES (
  current_setting('coach_foska.verify_admin_id')::UUID,
  current_setting('coach_foska.verify_athlete_id')::UUID,
  'block',
  'success',
  'sql-verifier',
  '{"source":"sql_verifier"}'::JSONB,
  200,
  '{"action":"block","userId":"sql-verifier-target"}'::JSONB
);
SELECT set_config(
  'coach_foska.verify_audit_inserted',
  EXISTS (
    SELECT 1
    FROM public.admin_security_audit
    WHERE request_id = 'sql-verifier'
  )::TEXT,
  true
);
RESET ROLE;
INSERT INTO admin_mfa_checks VALUES (
  'service role can append an audit record',
  current_setting('coach_foska.verify_audit_inserted')::BOOLEAN
);
INSERT INTO admin_mfa_checks VALUES (
  'attempt audit rows reject terminal replay fields',
  current_setting('coach_foska.verify_attempt_response_rejected')::BOOLEAN
);
INSERT INTO admin_mfa_checks VALUES (
  'terminal audit rows require exact replay fields',
  current_setting('coach_foska.verify_terminal_response_required')::BOOLEAN
);
INSERT INTO admin_mfa_checks VALUES (
  'atomic profile action denies an admin target',
  current_setting('coach_foska.verify_admin_target_denied') = 'admin_target_denied'
);
INSERT INTO admin_mfa_checks VALUES (
  'atomic profile action updates a non-admin target without a zero-row success',
  current_setting('coach_foska.verify_athlete_blocked') = 'updated'
    AND current_setting('coach_foska.verify_athlete_unblocked') = 'updated'
);

SELECT check_name, passed
FROM admin_mfa_checks
ORDER BY check_name;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM admin_mfa_checks WHERE NOT passed) THEN
    RAISE EXCEPTION 'one or more administrator MFA verification checks failed';
  END IF;
END;
$$;

ROLLBACK;
