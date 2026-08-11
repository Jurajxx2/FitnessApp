-- Run after applying 20260811171109_restrict_workout_reads_to_authenticated.sql:
--   supabase db query --linked --file supabase/verification/workout_authenticated_access.sql
-- Every row must report passed = true.

SELECT
  'RLS remains enabled on both workout tables' AS check_name,
  (
    SELECT count(*) = 2
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('workouts', 'workout_exercises')
      AND relation.relrowsecurity
  ) AS passed

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
  'No anonymous permissive read policy remains',
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
  'Active library assignment and owner branches remain in workout reads',
  EXISTS (
    SELECT 1
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = 'workouts'
      AND policy.policyname = 'Users can read assigned workouts'
      AND policy.qual LIKE '%user_id IS NULL%'
      AND policy.qual LIKE '%source = ''coach''%'
      AND policy.qual LIKE '%is_active%'
      AND policy.qual LIKE '%auth.uid()%user_id%'
      AND policy.qual LIKE '%auth.uid()%owner_user_id%'
  )

UNION ALL

SELECT
  'Exercise reads mirror active library assignment and owner access',
  EXISTS (
    SELECT 1
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = 'workout_exercises'
      AND policy.policyname = 'Users can read exercises for accessible workouts'
      AND policy.qual LIKE '%EXISTS%'
      AND policy.qual LIKE '%user_id IS NULL%'
      AND policy.qual LIKE '%source = ''coach''%'
      AND policy.qual LIKE '%is_active%'
      AND policy.qual LIKE '%user_id%auth.uid()%'
      AND policy.qual LIKE '%owner_user_id%auth.uid()%'
  )

UNION ALL

SELECT
  'Admin and owner management policies remain installed',
  (
    SELECT count(*) = 5
      AND bool_and(policy.roles = ARRAY['authenticated']::name[])
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND (
        (policy.tablename = 'workouts' AND policy.policyname IN (
          'Admin can manage all workouts',
          'Admins read all workouts',
          'Users manage own workouts'
        ))
        OR
        (policy.tablename = 'workout_exercises' AND policy.policyname IN (
          'Admin can manage all workout exercises',
          'Users manage exercises of own workouts'
        ))
      )
  )

UNION ALL

SELECT
  'Workout assignment policies remain authenticated',
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

ORDER BY check_name;
