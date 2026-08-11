-- Post-deployment structural verification for
-- 20260811173323_expand_athlete_admin_notes.sql.
--
-- This script is read-only. It raises an exception when the expansion contract
-- is incomplete and otherwise returns one success row.

DO $verification$
DECLARE
  notes_table_oid OID := to_regclass('public.athlete_admin_notes');
  update_rpc_oid OID := to_regprocedure(
    'public.admin_update_athlete_profile(uuid,text,integer,real,real,text,text,boolean,text,text)'
  );
  compatibility_trigger_function_oid OID := to_regprocedure(
    'private.sync_athlete_admin_note_from_profile()'
  );
  update_rpc_definition TEXT;
  compatibility_trigger_function_definition TEXT;
BEGIN
  IF notes_table_oid IS NULL THEN
    RAISE EXCEPTION 'public.athlete_admin_notes is missing';
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
    FROM pg_catalog.pg_constraint AS constraint_record
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = constraint_record.conrelid
     AND attribute.attnum = ANY (constraint_record.conkey)
    WHERE constraint_record.conrelid = notes_table_oid
      AND constraint_record.contype = 'p'
      AND attribute.attname = 'profile_id'
  ) THEN
    RAISE EXCEPTION 'profile_id is not the primary key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = constraint_record.conrelid
     AND attribute.attnum = ANY (constraint_record.conkey)
    WHERE constraint_record.conrelid = notes_table_oid
      AND constraint_record.contype = 'f'
      AND constraint_record.confrelid = 'public.profiles'::regclass
      AND constraint_record.confdeltype = 'c'
      AND attribute.attname = 'profile_id'
  ) THEN
    RAISE EXCEPTION 'profile_id cascading profiles FK is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = constraint_record.conrelid
     AND attribute.attnum = ANY (constraint_record.conkey)
    WHERE constraint_record.conrelid = notes_table_oid
      AND constraint_record.contype = 'f'
      AND constraint_record.confrelid = 'public.profiles'::regclass
      AND constraint_record.confdeltype = 'n'
      AND attribute.attname = 'updated_by'
  ) THEN
    RAISE EXCEPTION 'updated_by profiles FK is missing or has the wrong delete action';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'athlete_admin_notes'
      AND indexname = 'athlete_admin_notes_updated_by_idx'
  ) THEN
    RAISE EXCEPTION 'updated_by FK index is missing';
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

  IF compatibility_trigger_function_oid IS NULL THEN
    RAISE EXCEPTION 'legacy admin-notes compatibility trigger function is missing';
  END IF;

  SELECT pg_get_functiondef(compatibility_trigger_function_oid)
  INTO compatibility_trigger_function_definition;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_record
    WHERE procedure_record.oid = compatibility_trigger_function_oid
      AND (
        NOT procedure_record.prosecdef
        OR procedure_record.prorettype <> 'trigger'::regtype
        OR procedure_record.proconfig IS DISTINCT FROM ARRAY['search_path=""']::TEXT[]
      )
  ) THEN
    RAISE EXCEPTION 'legacy admin-notes compatibility trigger function is not hardened';
  END IF;

  IF compatibility_trigger_function_definition NOT LIKE
       '%INSERT INTO public.athlete_admin_notes%'
     OR compatibility_trigger_function_definition NOT LIKE
       '%DELETE FROM public.athlete_admin_notes%'
     OR compatibility_trigger_function_definition NOT LIKE '%auth.uid()%'
     OR compatibility_trigger_function_definition NOT LIKE '%public.get_is_admin()%'
     OR compatibility_trigger_function_definition NOT LIKE '%NEW.admin_notes IS NOT DISTINCT FROM OLD.admin_notes%'
     OR compatibility_trigger_function_definition NOT LIKE '%42501%' THEN
    RAISE EXCEPTION 'legacy admin-notes compatibility trigger function is incomplete';
  END IF;

  IF has_function_privilege(
       'anon',
       'private.sync_athlete_admin_note_from_profile()',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'private.sync_athlete_admin_note_from_profile()',
       'EXECUTE'
     )
     OR has_function_privilege(
       'service_role',
       'private.sync_athlete_admin_note_from_profile()',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'compatibility trigger function has an unnecessary execute grant';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'public.profiles'::regclass
      AND trigger_record.tgfoid = compatibility_trigger_function_oid
      AND trigger_record.tgname = 'sync_athlete_admin_note_from_profile'
      AND NOT trigger_record.tgisinternal
      AND trigger_record.tgenabled <> 'D'
      AND pg_get_triggerdef(trigger_record.oid) LIKE '%AFTER INSERT OR UPDATE OF admin_notes%'
  ) THEN
    RAISE EXCEPTION 'legacy admin-notes compatibility trigger is missing or disabled';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    LEFT JOIN public.athlete_admin_notes AS admin_note
      ON admin_note.profile_id = profile.id
    WHERE admin_note.notes IS DISTINCT FROM profile.admin_notes
  ) THEN
    RAISE EXCEPTION 'one or more legacy admin notes were not backfilled';
  END IF;

  IF update_rpc_oid IS NULL THEN
    RAISE EXCEPTION 'admin_update_athlete_profile RPC is missing';
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
        OR procedure_record.proconfig IS DISTINCT FROM ARRAY['search_path=""']::TEXT[]
      )
  ) THEN
    RAISE EXCEPTION 'admin_update_athlete_profile security or return contract changed';
  END IF;

  IF update_rpc_definition NOT LIKE '%UPDATE public.profiles%'
     OR update_rpc_definition NOT LIKE '%INSERT INTO public.athlete_admin_notes%'
     OR update_rpc_definition NOT LIKE '%DELETE FROM public.athlete_admin_notes%' THEN
    RAISE EXCEPTION 'admin_update_athlete_profile does not implement the dual-write contract';
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
END
$verification$;

SELECT 'athlete_admin_notes expansion contract verified' AS result;
