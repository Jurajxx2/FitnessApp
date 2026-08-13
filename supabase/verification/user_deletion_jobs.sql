-- Run after applying 20260811234825_add_retryable_user_deletion_jobs.sql:
--   supabase db query --linked \
--     --file supabase/verification/user_deletion_jobs.sql
--
-- This script NEVER touches a live user row. It creates its own synthetic
-- auth.users + public.profiles fixtures inside the transaction, drives the real
-- service-role deletion RPCs against those, and rolls everything back. No live
-- athlete is ever blocked, and no exclusive advisory lock is ever held on a
-- real user's key, so a stalled session cannot stop a real user's uploads.
--
-- Nothing here deletes an Auth user: every probe stops at the
-- ownership/reference preflight. Every returned row must report passed = true.
--
-- The connection role must be able to INSERT into auth.users (the `postgres`
-- role used by `supabase db query --linked` can; this is the same capability
-- `supabase/seed.sql`-style fixtures rely on).

BEGIN;

CREATE TEMP TABLE user_deletion_job_checks (
  check_name TEXT PRIMARY KEY,
  passed BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES
  (
    'workout owner fence also watches the owner_user_id column',
    EXISTS (
      SELECT 1
      FROM pg_trigger AS trigger_record
      WHERE trigger_record.tgrelid = 'public.workouts'::regclass
        AND trigger_record.tgname = 'lock_workout_owner_during_deletion'
        AND NOT trigger_record.tgisinternal
        AND trigger_record.tgenabled <> 'D'
        AND position(
          'owner_user_id' IN pg_get_triggerdef(trigger_record.oid)
        ) > 0
        AND position(
          'user_id' IN pg_get_triggerdef(trigger_record.oid)
        ) > 0
    )
  ),
  (
    'authored feedback fence is installed on workout_feedback',
    EXISTS (
      SELECT 1
      FROM pg_trigger AS trigger_record
      WHERE trigger_record.tgrelid = 'public.workout_feedback'::regclass
        AND trigger_record.tgname = 'lock_workout_feedback_during_deletion'
        AND NOT trigger_record.tgisinternal
        AND trigger_record.tgenabled <> 'D'
        AND position(
          'coach_id' IN pg_get_triggerdef(trigger_record.oid)
        ) > 0
    )
  ),
  (
    'every deletion lock helper is security definer with an empty search path',
    (
      SELECT count(*) = 4
        AND bool_and(procedure_record.prosecdef)
        AND bool_and(
          procedure_record.proconfig = ARRAY['search_path=""']::TEXT[]
        )
        AND bool_and(
          pg_get_functiondef(procedure_record.oid)
            LIKE '%hashtextextended(%::TEXT, 24001)%'
        )
      FROM pg_proc AS procedure_record
      JOIN pg_namespace AS namespace
        ON namespace.oid = procedure_record.pronamespace
      WHERE namespace.nspname = 'private'
        AND procedure_record.proname IN (
          'lock_deletion_storage_write',
          'lock_deletion_content_assignment',
          'lock_deletion_direct_content_owner',
          'lock_deletion_feedback_author'
        )
    )
  ),
  (
    'the authored feedback fence is not callable by API roles',
    NOT has_function_privilege(
      'anon',
      'private.lock_deletion_feedback_author()',
      'EXECUTE'
    )
      AND NOT has_function_privilege(
        'authenticated',
        'private.lock_deletion_feedback_author()',
        'EXECUTE'
      )
  ),
  -- Invariant (c): a fence must lock exactly the keys its rejection predicate
  -- tests. These two probes pin the LOCK SET itself, not merely the absence of
  -- an OLD reference: the athlete key must never enter either lock set, or an
  -- ordinary write path re-enters the deletion keyspace and can deadlock
  -- against admin_begin_user_deletion's exclusive lock.
  (
    'the authored feedback fence locks exactly one key and it is the author',
    (
      SELECT
        -- Exactly one lock, and its argument is literally the author key.
        (
          length(definition.body)
          - length(replace(definition.body, 'pg_advisory_xact_lock_shared(', ''))
        ) / length('pg_advisory_xact_lock_shared(') = 1
        AND position(
          'hashtextextended(NEW.coach_id::TEXT, 24001)' IN definition.body
        ) > 0
        -- NEW.user_id may appear only in the rejection predicate. A second
        -- occurrence means the athlete key reached a lock.
        AND (
          length(definition.body)
          - length(replace(definition.body, 'NEW.user_id', ''))
        ) / length('NEW.user_id') = 1
        AND position('OLD' IN definition.body) = 0
      FROM pg_proc AS procedure_record
      JOIN pg_namespace AS namespace
        ON namespace.oid = procedure_record.pronamespace
      CROSS JOIN LATERAL (
        SELECT pg_get_functiondef(procedure_record.oid) AS body
      ) AS definition
      WHERE namespace.nspname = 'private'
        AND procedure_record.proname = 'lock_deletion_feedback_author'
    )
  ),
  (
    'the direct content owner fence locks only the two NEW ownership keys',
    (
      SELECT
        (
          length(definition.body)
          - length(replace(definition.body, 'pg_advisory_xact_lock_shared(', ''))
        ) / length('pg_advisory_xact_lock_shared(') = 1
        -- Fail closed if the candidate list can no longer be isolated.
        AND position('VALUES' IN definition.body) > 0
        AND position(') AS owner_candidate(owner_id)' IN definition.body)
          > position('VALUES' IN definition.body)
        -- The lock-candidate list is exactly the two NEW ownership values.
        AND position('v_new_user_id' IN candidates.list) > 0
        AND position('v_new_owner_user_id' IN candidates.list) > 0
        AND position('v_old' IN candidates.list) = 0
        AND position('OLD' IN candidates.list) = 0
        AND position('v_old' IN definition.body) = 0
      FROM pg_proc AS procedure_record
      JOIN pg_namespace AS namespace
        ON namespace.oid = procedure_record.pronamespace
      CROSS JOIN LATERAL (
        SELECT pg_get_functiondef(procedure_record.oid) AS body
      ) AS definition
      CROSS JOIN LATERAL (
        SELECT substring(
          definition.body
          FROM position('VALUES' IN definition.body)
          FOR position(') AS owner_candidate(owner_id)' IN definition.body)
            - position('VALUES' IN definition.body)
        ) AS list
      ) AS candidates
      WHERE namespace.nspname = 'private'
        AND procedure_record.proname = 'lock_deletion_direct_content_owner'
    )
  );

-- Synthetic fixtures only. The ids sit in an obviously non-production namespace
-- and the addresses use the reserved .test TLD, so a leftover row from a killed
-- session is trivially identifiable. requested_by carries no foreign key, so no
-- administrator fixture is needed.
DO $$
DECLARE
  target_id UUID := 'dde11111-0000-4000-8000-000000000001';
  other_id UUID := 'dde11111-0000-4000-8000-000000000002';
  requester_id UUID := 'dde11111-0000-4000-8000-000000000003';
  shared_workout_id UUID := 'dde11111-0000-4000-8000-000000000011';
  unassigned_workout_id UUID := 'dde11111-0000-4000-8000-000000000012';
  transfer_workout_id UUID := 'dde11111-0000-4000-8000-000000000013';
  divergent_workout_id UUID := 'dde11111-0000-4000-8000-000000000014';
  other_log_id UUID := 'dde11111-0000-4000-8000-000000000021';
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users AS auth_user
    WHERE auth_user.id IN (target_id, other_id, requester_id)
  ) OR EXISTS (
    SELECT 1 FROM public.workouts AS workout
    WHERE workout.id IN (
      shared_workout_id,
      unassigned_workout_id,
      transfer_workout_id,
      divergent_workout_id
    )
  ) THEN
    RAISE EXCEPTION
      'deletion verifier fixtures already exist; clean up rows in the dde11111-0000-4000-8000-* namespace first';
  END IF;

  PERFORM set_config('coach_foska.deletion_target', target_id::TEXT, true);
  PERFORM set_config('coach_foska.deletion_other', other_id::TEXT, true);
  PERFORM set_config('coach_foska.deletion_requester', requester_id::TEXT, true);
  PERFORM set_config(
    'coach_foska.deletion_shared_workout', shared_workout_id::TEXT, true
  );
  PERFORM set_config(
    'coach_foska.deletion_unassigned_workout', unassigned_workout_id::TEXT, true
  );
  PERFORM set_config(
    'coach_foska.deletion_transfer_workout', transfer_workout_id::TEXT, true
  );
  PERFORM set_config(
    'coach_foska.deletion_divergent_workout', divergent_workout_id::TEXT, true
  );
  PERFORM set_config('coach_foska.deletion_other_log', other_log_id::TEXT, true);

  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES
    (
      target_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      'authenticated',
      'authenticated',
      'deletion-verifier+target@invalid.test'
    ),
    (
      other_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      'authenticated',
      'authenticated',
      'deletion-verifier+other@invalid.test'
    );

  -- public.handle_new_user() normally creates these rows from the auth trigger;
  -- the upsert keeps the verifier correct either way and pins the flags the
  -- begin RPC inspects.
  INSERT INTO public.profiles (id, email, is_admin, is_blocked, access_mode)
  VALUES
    (target_id, 'deletion-verifier+target@invalid.test', false, false, 'both'),
    (other_id, 'deletion-verifier+other@invalid.test', false, false, 'both')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      is_admin = EXCLUDED.is_admin,
      is_blocked = EXCLUDED.is_blocked,
      access_mode = EXCLUDED.access_mode;

  -- shared: owned ONLY through owner_user_id and assigned to the other athlete;
  -- the legacy user_id-only preflight missed this shape entirely.
  -- divergent: the two ownership columns point at different users and there is
  -- no assignment at all; workouts_user_id_fkey becomes ON DELETE CASCADE in
  -- this migration, so this shape is newly destructive for the other owner.
  INSERT INTO public.workouts (
    id, user_id, name, is_active, source, owner_user_id
  ) VALUES
    (
      shared_workout_id, NULL, 'Deletion verifier: owner-shared workout',
      false, 'user', target_id
    ),
    (
      unassigned_workout_id, NULL, 'Deletion verifier: owner-only workout',
      false, 'user', target_id
    ),
    (
      transfer_workout_id, NULL, 'Deletion verifier: transfer candidate',
      false, 'coach', NULL
    ),
    (
      divergent_workout_id, target_id,
      'Deletion verifier: divergently owned workout',
      false, 'coach', other_id
    );

  INSERT INTO public.user_workouts (user_id, workout_id)
  VALUES (other_id, shared_workout_id);

  INSERT INTO public.workout_logs (id, user_id, workout_name)
  VALUES (other_log_id, other_id, 'Deletion verifier: other athlete log');
END;
$$;

-- The durable orchestration RPCs are service-role only in production.
SET LOCAL ROLE service_role;
SELECT
  set_config('coach_foska.deletion_job_id', job.id::TEXT, true),
  set_config('coach_foska.deletion_begin_status', job.status, true),
  set_config(
    'coach_foska.deletion_begin_code', COALESCE(job.last_error_code, ''), true
  )
FROM public.admin_begin_user_deletion(
  current_setting('coach_foska.deletion_target')::UUID,
  current_setting('coach_foska.deletion_requester')::UUID
) AS job;
RESET ROLE;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'begin routes an owner_user_id workout assigned to another athlete to manual review',
  current_setting('coach_foska.deletion_begin_status') = 'manual_review'
    AND current_setting('coach_foska.deletion_begin_code') = 'shared_direct_content'
);

SET LOCAL ROLE service_role;
SELECT
  set_config('coach_foska.deletion_blocked_recheck_status', job.status, true),
  set_config(
    'coach_foska.deletion_blocked_recheck_code',
    COALESCE(job.last_error_code, ''),
    true
  )
FROM public.admin_recheck_user_deletion_manual_review(
  current_setting('coach_foska.deletion_job_id')::UUID
) AS job;
RESET ROLE;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'recheck refuses to resume while the owner-shared workout stays assigned',
  current_setting('coach_foska.deletion_blocked_recheck_status') = 'manual_review'
    AND current_setting('coach_foska.deletion_blocked_recheck_code')
      = 'shared_direct_content'
);

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'the other athlete keeps the shared workout and its assignment',
  EXISTS (
    SELECT 1
    FROM public.workouts AS workout
    WHERE workout.id = current_setting('coach_foska.deletion_shared_workout')::UUID
      AND workout.owner_user_id = current_setting('coach_foska.deletion_target')::UUID
  )
    AND EXISTS (
      SELECT 1
      FROM public.user_workouts AS assignment
      WHERE assignment.workout_id
          = current_setting('coach_foska.deletion_shared_workout')::UUID
        AND assignment.user_id = current_setting('coach_foska.deletion_other')::UUID
    )
);

-- A new cross-user assignment for an owner_user_id-owned workout must be fenced
-- while the owner has an active deletion job.
DO $$
DECLARE
  raised_sqlstate TEXT := '';
  raised_message TEXT := '';
BEGIN
  BEGIN
    INSERT INTO public.user_workouts (user_id, workout_id)
    VALUES (
      current_setting('coach_foska.deletion_other')::UUID,
      current_setting('coach_foska.deletion_unassigned_workout')::UUID
    );
  EXCEPTION WHEN OTHERS THEN
    raised_sqlstate := SQLSTATE;
    raised_message := SQLERRM;
  END;
  PERFORM set_config(
    'coach_foska.deletion_assignment_fence', raised_sqlstate, true
  );
  PERFORM set_config(
    'coach_foska.deletion_assignment_fence_message', raised_message, true
  );
END;
$$;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'assigning an owner_user_id workout to another athlete is fenced',
  current_setting('coach_foska.deletion_assignment_fence') = '23514'
    AND current_setting('coach_foska.deletion_assignment_fence_message')
      = 'Direct content owner has an active deletion job'
);

-- Transferring ownership onto the target must fire on the owner_user_id column.
DO $$
DECLARE
  raised_sqlstate TEXT := '';
  raised_message TEXT := '';
BEGIN
  BEGIN
    UPDATE public.workouts
    SET owner_user_id = current_setting('coach_foska.deletion_target')::UUID
    WHERE id = current_setting('coach_foska.deletion_transfer_workout')::UUID;
  EXCEPTION WHEN OTHERS THEN
    raised_sqlstate := SQLSTATE;
    raised_message := SQLERRM;
  END;
  PERFORM set_config('coach_foska.deletion_owner_fence', raised_sqlstate, true);
  PERFORM set_config(
    'coach_foska.deletion_owner_fence_message', raised_message, true
  );
END;
$$;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'moving workouts.owner_user_id onto a deletion target is fenced',
  current_setting('coach_foska.deletion_owner_fence') = '23514'
    AND current_setting('coach_foska.deletion_owner_fence_message')
      = 'Direct content owner has an active deletion job'
);

-- Clearing the cross-user assignment is not enough: the divergently owned
-- workout is still a cascade that would destroy the other owner's row.
DELETE FROM public.user_workouts
WHERE workout_id = current_setting('coach_foska.deletion_shared_workout')::UUID;

SET LOCAL ROLE service_role;
SELECT
  set_config('coach_foska.deletion_divergent_status', job.status, true),
  set_config(
    'coach_foska.deletion_divergent_code', COALESCE(job.last_error_code, ''), true
  )
FROM public.admin_recheck_user_deletion_manual_review(
  current_setting('coach_foska.deletion_job_id')::UUID
) AS job;
RESET ROLE;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'a workout whose two ownership columns name different users still blocks resume',
  current_setting('coach_foska.deletion_divergent_status') = 'manual_review'
    AND current_setting('coach_foska.deletion_divergent_code')
      = 'shared_direct_content'
);

-- Resolving divergent ownership must clear BOTH columns in one statement:
-- clearing only owner_user_id leaves user_id on the target and is rejected.
DO $$
DECLARE
  raised_sqlstate TEXT := '';
  raised_message TEXT := '';
BEGIN
  BEGIN
    UPDATE public.workouts
    SET owner_user_id = NULL
    WHERE id = current_setting('coach_foska.deletion_divergent_workout')::UUID;
  EXCEPTION WHEN OTHERS THEN
    raised_sqlstate := SQLSTATE;
    raised_message := SQLERRM;
  END;
  PERFORM set_config(
    'coach_foska.deletion_partial_transfer_fence', raised_sqlstate, true
  );
  PERFORM set_config(
    'coach_foska.deletion_partial_transfer_fence_message', raised_message, true
  );
END;
$$;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'clearing only one ownership column while the other names the target is fenced',
  current_setting('coach_foska.deletion_partial_transfer_fence') = '23514'
    AND current_setting('coach_foska.deletion_partial_transfer_fence_message')
      = 'Direct content owner has an active deletion job'
);

UPDATE public.workouts
SET user_id = NULL, owner_user_id = NULL
WHERE id = current_setting('coach_foska.deletion_divergent_workout')::UUID;

SET LOCAL ROLE service_role;
SELECT
  set_config('coach_foska.deletion_resumed_status', job.status, true),
  set_config(
    'coach_foska.deletion_resumed_code', COALESCE(job.last_error_code, ''), true
  )
FROM public.admin_recheck_user_deletion_manual_review(
  current_setting('coach_foska.deletion_job_id')::UUID
) AS job;
RESET ROLE;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'recheck resumes to cleaning_storage once every shared workout is cleared',
  current_setting('coach_foska.deletion_resumed_status') = 'cleaning_storage'
    AND current_setting('coach_foska.deletion_resumed_code') = ''
);

-- Authored coach feedback on another athlete's log is the second cascade edge.
-- In production it is reachable only for a demoted ex-admin, because inserting
-- feedback requires get_is_admin() AND coach_id = auth.uid() while the begin RPC
-- refuses to open a job for an is_admin profile. The fixture reproduces exactly
-- that end state: a non-admin profile that still owns authored feedback.
-- Retire the resumed job first: the fence would otherwise reject the fixture.
SET LOCAL ROLE service_role;
DELETE FROM public.user_deletion_jobs
WHERE id = current_setting('coach_foska.deletion_job_id')::UUID;
RESET ROLE;

INSERT INTO public.workout_feedback (user_id, coach_id, workout_log_id, body)
VALUES (
  current_setting('coach_foska.deletion_other')::UUID,
  current_setting('coach_foska.deletion_target')::UUID,
  current_setting('coach_foska.deletion_other_log')::UUID,
  'Deletion verifier: coach feedback authored for another athlete'
);

SET LOCAL ROLE service_role;
SELECT
  set_config('coach_foska.deletion_authored_job', job.id::TEXT, true),
  set_config('coach_foska.deletion_authored_status', job.status, true),
  set_config(
    'coach_foska.deletion_authored_code', COALESCE(job.last_error_code, ''), true
  ),
  set_config(
    'coach_foska.deletion_authored_message',
    COALESCE(job.last_error_message, ''),
    true
  )
FROM public.admin_begin_user_deletion(
  current_setting('coach_foska.deletion_target')::UUID,
  current_setting('coach_foska.deletion_requester')::UUID
) AS job;
RESET ROLE;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'begin routes authored coach feedback on another athlete to manual review',
  current_setting('coach_foska.deletion_authored_status') = 'manual_review'
    AND current_setting('coach_foska.deletion_authored_code')
      = 'shared_authored_content'
    AND current_setting('coach_foska.deletion_authored_message')
      = 'Target authored coach feedback on another user''s training log.'
);

-- With the job active again, authoring more cross-user feedback is fenced.
DO $$
DECLARE
  raised_sqlstate TEXT := '';
  raised_message TEXT := '';
BEGIN
  BEGIN
    INSERT INTO public.workout_feedback (user_id, coach_id, workout_log_id, body)
    VALUES (
      current_setting('coach_foska.deletion_other')::UUID,
      current_setting('coach_foska.deletion_target')::UUID,
      current_setting('coach_foska.deletion_other_log')::UUID,
      'Deletion verifier: feedback authored after deletion began'
    );
  EXCEPTION WHEN OTHERS THEN
    raised_sqlstate := SQLSTATE;
    raised_message := SQLERRM;
  END;
  PERFORM set_config(
    'coach_foska.deletion_feedback_fence', raised_sqlstate, true
  );
  PERFORM set_config(
    'coach_foska.deletion_feedback_fence_message', raised_message, true
  );
END;
$$;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'authoring cross-user feedback during an active deletion job is fenced',
  current_setting('coach_foska.deletion_feedback_fence') = '23514'
    AND current_setting('coach_foska.deletion_feedback_fence_message')
      = 'Feedback author has an active deletion job'
);

SET LOCAL ROLE service_role;
SELECT
  set_config('coach_foska.deletion_authored_recheck_status', job.status, true),
  set_config(
    'coach_foska.deletion_authored_recheck_code',
    COALESCE(job.last_error_code, ''),
    true
  )
FROM public.admin_recheck_user_deletion_manual_review(
  current_setting('coach_foska.deletion_authored_job')::UUID
) AS job;
RESET ROLE;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES (
  'recheck refuses to resume while the authored feedback remains',
  current_setting('coach_foska.deletion_authored_recheck_status') = 'manual_review'
    AND current_setting('coach_foska.deletion_authored_recheck_code')
      = 'shared_authored_content'
);

-- The leased Auth-stage preflight must classify the same edge. The fixture has
-- to precede the job (the fence blocks it otherwise) and the recheck RPC only
-- re-evaluates manual_review jobs, so the job is returned to a claimable state
-- and leased through the real claim RPC.
SET LOCAL ROLE service_role;
UPDATE public.user_deletion_jobs
SET status = 'requested',
    last_error_code = NULL,
    last_error_message = NULL
WHERE id = current_setting('coach_foska.deletion_authored_job')::UUID;

SELECT set_config(
  'coach_foska.deletion_lease', COALESCE(job.lease_token::TEXT, ''), true
)
FROM public.admin_claim_user_deletion(
  current_setting('coach_foska.deletion_authored_job')::UUID,
  120
) AS job;

DO $$
BEGIN
  IF COALESCE(current_setting('coach_foska.deletion_lease', true), '') = '' THEN
    RAISE EXCEPTION 'deletion verifier could not lease the job for a preflight probe';
  END IF;
END;
$$;

SELECT
  set_config('coach_foska.deletion_preflight_ready', preflight.ready::TEXT, true),
  set_config(
    'coach_foska.deletion_preflight_status', preflight.next_status, true
  ),
  set_config(
    'coach_foska.deletion_preflight_code',
    COALESCE(preflight.error_code, ''),
    true
  )
FROM public.admin_preflight_user_deletion(
  current_setting('coach_foska.deletion_authored_job')::UUID,
  current_setting('coach_foska.deletion_lease')::UUID
) AS preflight;

SELECT
  set_config('coach_foska.deletion_final_status', job.status, true),
  set_config(
    'coach_foska.deletion_final_code', COALESCE(job.last_error_code, ''), true
  )
FROM public.user_deletion_jobs AS job
WHERE job.id = current_setting('coach_foska.deletion_authored_job')::UUID;
RESET ROLE;

INSERT INTO user_deletion_job_checks (check_name, passed)
VALUES
  (
    'the leased preflight stops Auth deletion for authored feedback',
    current_setting('coach_foska.deletion_preflight_ready')::BOOLEAN = false
      AND current_setting('coach_foska.deletion_preflight_status') = 'manual_review'
      AND current_setting('coach_foska.deletion_preflight_code')
        = 'shared_authored_content'
  ),
  (
    'the durable job records the authored-content manual review for the operator',
    current_setting('coach_foska.deletion_final_status') = 'manual_review'
      AND current_setting('coach_foska.deletion_final_code')
        = 'shared_authored_content'
  ),
  (
    'the other athlete keeps the authored feedback row',
    EXISTS (
      SELECT 1
      FROM public.workout_feedback AS feedback
      WHERE feedback.coach_id = current_setting('coach_foska.deletion_target')::UUID
        AND feedback.user_id = current_setting('coach_foska.deletion_other')::UUID
    )
  );

SELECT check_name, passed
FROM user_deletion_job_checks
ORDER BY check_name;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_deletion_job_checks WHERE NOT passed) THEN
    RAISE EXCEPTION 'one or more retryable user deletion verification checks failed';
  END IF;
END;
$$;

ROLLBACK;
