-- Post-deployment structural verification for
-- 20260811175009_cleanup_athlete_admin_notes.sql.
--
-- This script is read-only. It raises an exception when the final coach-notes
-- contract is incomplete and otherwise returns one success row.

DO $verification$
DECLARE
  notes_table_oid OID := to_regclass('public.athlete_admin_notes');
  update_rpc_oid OID := to_regprocedure(
    'public.admin_update_athlete_profile(uuid,text,integer,real,real,text,text,boolean,text,text)'
  );
  update_rpc_definition TEXT;
BEGIN
  IF notes_table_oid IS NULL THEN
    RAISE EXCEPTION 'public.athlete_admin_notes is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.profiles'::regclass
      AND attribute.attname = 'admin_notes'
      AND NOT attribute.attisdropped
  ) THEN
    RAISE EXCEPTION 'profiles.admin_notes still exists';
  END IF;

  IF to_regprocedure('private.sync_athlete_admin_note_from_profile()') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy coach-note sync function still exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'public.profiles'::regclass
      AND trigger_record.tgname = 'sync_athlete_admin_note_from_profile'
      AND NOT trigger_record.tgisinternal
  ) THEN
    RAISE EXCEPTION 'legacy coach-note sync trigger still exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = notes_table_oid
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.athlete_admin_notes';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'athlete_admin_notes'
      AND policyname = 'Admins manage athlete admin notes'
      AND cmd = 'ALL'
      AND roles = ARRAY['authenticated']::name[]
      AND qual LIKE '%get_is_admin%'
      AND with_check LIKE '%get_is_admin%'
  ) THEN
    RAISE EXCEPTION 'admin-only athlete_admin_notes policy is missing or malformed';
  END IF;

  IF has_table_privilege('anon', 'public.athlete_admin_notes', 'SELECT')
     OR has_table_privilege('anon', 'public.athlete_admin_notes', 'INSERT')
     OR has_table_privilege('anon', 'public.athlete_admin_notes', 'UPDATE')
     OR has_table_privilege('anon', 'public.athlete_admin_notes', 'DELETE') THEN
    RAISE EXCEPTION 'anon retains a DML privilege on public.athlete_admin_notes';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.athlete_admin_notes', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.athlete_admin_notes', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.athlete_admin_notes', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.athlete_admin_notes', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated lacks a DML privilege required by admin RLS';
  END IF;

  IF update_rpc_oid IS NULL THEN
    RAISE EXCEPTION 'ten-argument admin_update_athlete_profile RPC is missing';
  END IF;

  SELECT pg_get_functiondef(update_rpc_oid)
  INTO update_rpc_definition;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_record
    WHERE procedure_record.oid = update_rpc_oid
      AND (
        procedure_record.prosecdef
        OR procedure_record.prorettype <> 'uuid'::regtype
        OR procedure_record.pronargs <> 10
        OR procedure_record.proargnames IS DISTINCT FROM ARRAY[
          'p_user_id',
          'p_full_name',
          'p_age',
          'p_height_cm',
          'p_weight_kg',
          'p_goal',
          'p_activity_level',
          'p_onboarding_complete',
          'p_access_mode',
          'p_admin_notes'
        ]::TEXT[]
        OR procedure_record.proconfig IS DISTINCT FROM ARRAY['search_path=""']::TEXT[]
      )
  ) THEN
    RAISE EXCEPTION 'admin_update_athlete_profile security or return contract changed';
  END IF;

  IF update_rpc_definition NOT LIKE '%UPDATE public.profiles%'
     OR update_rpc_definition NOT LIKE '%INSERT INTO public.athlete_admin_notes%'
     OR update_rpc_definition NOT LIKE '%DELETE FROM public.athlete_admin_notes%'
     OR update_rpc_definition LIKE '%admin_notes = normalized_admin_notes%' THEN
    RAISE EXCEPTION 'admin_update_athlete_profile does not use the separated notes owner exclusively';
  END IF;

  IF has_function_privilege(
       'anon',
       'public.admin_update_athlete_profile(uuid,text,integer,real,real,text,text,boolean,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'anon can execute admin_update_athlete_profile';
  END IF;

  IF NOT has_function_privilege(
       'authenticated',
       'public.admin_update_athlete_profile(uuid,text,integer,real,real,text,text,boolean,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'authenticated cannot execute admin_update_athlete_profile';
  END IF;

  IF NOT has_function_privilege(
       'service_role',
       'public.admin_update_athlete_profile(uuid,text,integer,real,real,text,text,boolean,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'service_role cannot execute admin_update_athlete_profile';
  END IF;
END
$verification$;

SELECT 'athlete admin notes cleanup contract verified' AS result;
