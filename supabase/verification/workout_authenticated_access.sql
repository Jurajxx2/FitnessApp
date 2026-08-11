-- Run after applying 20260811173250_restrict_workout_reads_to_authenticated.sql:
--   supabase db query --linked \
--     --file supabase/verification/workout_authenticated_access.sql
--
-- The behavioral probes create transaction-local fixtures, impersonate the
-- authenticated and anon Postgres roles, and roll everything back.  Every
-- returned row must report passed = true.

BEGIN;

CREATE TEMP TABLE workout_rls_checks (
  check_name TEXT PRIMARY KEY,
  passed BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO workout_rls_checks (check_name, passed)
SELECT
  'RLS remains enabled on both workout tables',
  (
    SELECT count(*) = 2
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('workouts', 'workout_exercises')
      AND relation.relrowsecurity
  )

UNION ALL

SELECT
  'Workout read policies target only authenticated',
  (
    SELECT count(*) = 2
      AND bool_and(policy.roles = ARRAY['authenticated']::name[])
      AND bool_and(policy.cmd = 'SELECT')
      AND bool_and(policy.permissive = 'PERMISSIVE')
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND (
        (policy.tablename = 'workouts'
          AND policy.policyname = 'Users can read assigned workouts')
        OR
        (policy.tablename = 'workout_exercises'
          AND policy.policyname = 'Users can read exercises for accessible workouts')
      )
  )

UNION ALL

SELECT
  'No anonymous permissive workout read policy remains',
  NOT EXISTS (
    SELECT 1
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename IN ('workouts', 'workout_exercises')
      AND policy.permissive = 'PERMISSIVE'
      AND policy.cmd IN ('SELECT', 'ALL')
      AND policy.roles && ARRAY['public', 'anon']::name[]
  )

UNION ALL

SELECT
  'Workout policy preserves global legacy owner and modern assignment branches',
  EXISTS (
    SELECT 1
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = 'workouts'
      AND policy.policyname = 'Users can read assigned workouts'
      AND position('user_id IS NULL' IN policy.qual) > 0
      AND position('source = ''coach''' IN policy.qual) > 0
      AND position('is_active IS TRUE' IN policy.qual) > 0
      AND position('auth.uid()' IN policy.qual) > 0
      AND position('= user_id' IN policy.qual) > 0
      AND position('= owner_user_id' IN policy.qual) > 0
      AND position('user_workouts' IN policy.qual) > 0
      AND position('assignment.user_id' IN policy.qual) > 0
      AND position('assignment.workout_id' IN policy.qual) > 0
  )

UNION ALL

SELECT
  'Exercise policy mirrors all four workout access branches',
  EXISTS (
    SELECT 1
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = 'workout_exercises'
      AND policy.policyname = 'Users can read exercises for accessible workouts'
      AND position('workout.user_id IS NULL' IN policy.qual) > 0
      AND position('workout.source = ''coach''' IN policy.qual) > 0
      AND position('workout.is_active IS TRUE' IN policy.qual) > 0
      AND position('workout.user_id = ( SELECT auth.uid()' IN policy.qual) > 0
      AND position('workout.owner_user_id = ( SELECT auth.uid()' IN policy.qual) > 0
      AND position('user_workouts' IN policy.qual) > 0
      AND position('assignment.user_id' IN policy.qual) > 0
      AND position('assignment.workout_id' IN policy.qual) > 0
  )

UNION ALL

SELECT
  'Modern assignment policies and lookup index remain installed',
  (
    SELECT count(*) = 2
      AND bool_and(policy.roles = ARRAY['authenticated']::name[])
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = 'user_workouts'
      AND policy.policyname IN (
        'Users read own workout assignments',
        'Admins manage workout assignments'
      )
  )
  AND to_regclass('public.user_workouts_user_id_workout_id_key') IS NOT NULL

UNION ALL

SELECT
  'Admin owner and entitlement policies remain installed',
  (
    SELECT count(*) = 9
      AND bool_and(policy.roles = ARRAY['authenticated']::name[])
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND (
        (policy.tablename = 'workouts' AND policy.policyname IN (
          'Admin can manage all workouts',
          'Admins read all workouts',
          'Users manage own workouts',
          'feature_access_activity',
          'unblocked_accounts_only'
        ))
        OR
        (policy.tablename = 'workout_exercises' AND policy.policyname IN (
          'Admin can manage all workout exercises',
          'Users manage exercises of own workouts',
          'feature_access_activity',
          'unblocked_accounts_only'
        ))
      )
  );

-- Create five isolated workout shapes for one ordinary activity-enabled user:
-- active global library, modern junction assignment, legacy direct assignment,
-- user-owned, and an inaccessible inactive control.  UUIDs and the user ID are
-- stored in transaction-local settings so the role probes can reference them.
DO $$
DECLARE
  test_user_id UUID;
  active_global_id UUID := gen_random_uuid();
  modern_assignment_id UUID := gen_random_uuid();
  legacy_assignment_id UUID := gen_random_uuid();
  owner_workout_id UUID := gen_random_uuid();
  inaccessible_id UUID := gen_random_uuid();
BEGIN
  SELECT profile.id
  INTO test_user_id
  FROM public.profiles AS profile
  JOIN auth.users AS auth_user ON auth_user.id = profile.id
  WHERE NOT profile.is_admin
    AND NOT profile.is_blocked
    AND profile.access_mode IN ('activity', 'both')
  ORDER BY profile.created_at
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE EXCEPTION
      'workout RLS verifier needs one non-admin, unblocked activity-enabled profile';
  END IF;

  PERFORM set_config('coach_foska.workout_rls_user', test_user_id::TEXT, true);
  PERFORM set_config('coach_foska.workout_rls_active', active_global_id::TEXT, true);
  PERFORM set_config('coach_foska.workout_rls_modern', modern_assignment_id::TEXT, true);
  PERFORM set_config('coach_foska.workout_rls_legacy', legacy_assignment_id::TEXT, true);
  PERFORM set_config('coach_foska.workout_rls_owner', owner_workout_id::TEXT, true);
  PERFORM set_config('coach_foska.workout_rls_inaccessible', inaccessible_id::TEXT, true);

  INSERT INTO public.workouts (
    id, user_id, name, is_active, source, owner_user_id
  ) VALUES
    (active_global_id, NULL, 'RLS verifier: active global', true, 'coach', NULL),
    (modern_assignment_id, NULL, 'RLS verifier: modern assignment', false, 'coach', NULL),
    (legacy_assignment_id, test_user_id, 'RLS verifier: legacy assignment', false, 'coach', NULL),
    (owner_workout_id, NULL, 'RLS verifier: owner', false, 'user', test_user_id),
    (inaccessible_id, NULL, 'RLS verifier: inaccessible', false, 'coach', NULL);

  INSERT INTO public.workout_exercises (workout_id, name)
  VALUES
    (active_global_id, 'RLS verifier exercise'),
    (modern_assignment_id, 'RLS verifier exercise'),
    (legacy_assignment_id, 'RLS verifier exercise'),
    (owner_workout_id, 'RLS verifier exercise'),
    (inaccessible_id, 'RLS verifier exercise');

  INSERT INTO public.user_workouts (user_id, workout_id)
  VALUES (test_user_id, modern_assignment_id);
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('coach_foska.workout_rls_user'),
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT set_config(
  'coach_foska.workout_rls_authenticated_passed',
  (
    (
      SELECT count(*) = 4
      FROM public.workouts AS workout
      WHERE workout.id IN (
        current_setting('coach_foska.workout_rls_active')::UUID,
        current_setting('coach_foska.workout_rls_modern')::UUID,
        current_setting('coach_foska.workout_rls_legacy')::UUID,
        current_setting('coach_foska.workout_rls_owner')::UUID,
        current_setting('coach_foska.workout_rls_inaccessible')::UUID
      )
    )
    AND (
      SELECT count(*) = 4
      FROM public.workout_exercises AS exercise
      WHERE exercise.workout_id IN (
        current_setting('coach_foska.workout_rls_active')::UUID,
        current_setting('coach_foska.workout_rls_modern')::UUID,
        current_setting('coach_foska.workout_rls_legacy')::UUID,
        current_setting('coach_foska.workout_rls_owner')::UUID,
        current_setting('coach_foska.workout_rls_inaccessible')::UUID
      )
    )
  )::TEXT,
  true
);

SELECT set_config(
  'coach_foska.workout_rls_modern_passed',
  (
    EXISTS (
      SELECT 1
      FROM public.workouts AS workout
      WHERE workout.id = current_setting('coach_foska.workout_rls_modern')::UUID
    )
    AND EXISTS (
      SELECT 1
      FROM public.workout_exercises AS exercise
      WHERE exercise.workout_id = current_setting('coach_foska.workout_rls_modern')::UUID
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_workouts AS assignment
      WHERE assignment.user_id = current_setting('coach_foska.workout_rls_user')::UUID
        AND assignment.workout_id = current_setting('coach_foska.workout_rls_modern')::UUID
    )
  )::TEXT,
  true
);

RESET ROLE;

INSERT INTO workout_rls_checks (check_name, passed)
VALUES
  (
    'Authenticated user sees global modern legacy and owner branches only',
    current_setting('coach_foska.workout_rls_authenticated_passed')::BOOLEAN
  ),
  (
    'Modern user_workouts assignment exposes its workout and exercises',
    current_setting('coach_foska.workout_rls_modern_passed')::BOOLEAN
  );

SELECT set_config('request.jwt.claim.role', 'anon', true);
SET LOCAL ROLE anon;

SELECT set_config(
  'coach_foska.workout_rls_anon_passed',
  (
    NOT EXISTS (SELECT 1 FROM public.workouts)
    AND NOT EXISTS (SELECT 1 FROM public.workout_exercises)
  )::TEXT,
  true
);

RESET ROLE;

INSERT INTO workout_rls_checks (check_name, passed)
VALUES (
  'Anon role sees no workouts or workout exercises',
  current_setting('coach_foska.workout_rls_anon_passed')::BOOLEAN
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM workout_rls_checks WHERE NOT passed) THEN
    RAISE EXCEPTION 'one or more workout RLS verification checks failed';
  END IF;
END;
$$;

SELECT check_name, passed
FROM workout_rls_checks
ORDER BY check_name;

ROLLBACK;
