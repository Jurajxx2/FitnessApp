-- FINAL MFA ENFORCEMENT (stage 2 of 2).
--
-- Deployment order is mandatory:
--   1. Deploy the admin UI and Edge Functions first, while this migration is
--      still unapplied. Enroll and verify at least two controlled TOTP factors
--      for every admin account and test recovery/sign-in in a separate session.
--   2. Apply this migration only after that enrollment gate is complete.
--
-- Applying this migration first will intentionally lock aal1 admin sessions
-- out of every path which uses the central admin predicate.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- All current admin RLS policies and privileged RPCs converge on this helper.
-- Keep the service-role branch for server-owned maintenance/RPC composition;
-- service_role is already privileged and has no end-user MFA ceremony.
CREATE OR REPLACE FUNCTION private.get_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN COALESCE((SELECT auth.jwt() ->> 'role'), '') = 'service_role' THEN true
    WHEN COALESCE((SELECT auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' THEN false
    ELSE COALESCE((
      SELECT p.is_admin AND NOT p.is_blocked
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
    ), false)
  END
$$;

REVOKE ALL ON FUNCTION private.get_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.get_is_admin()
$$;

REVOKE ALL ON FUNCTION public.get_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_is_admin() TO authenticated, service_role;

-- These two legacy policies predate the central predicate and used an app
-- metadata role claim directly. Replace them so they cannot bypass aal2.
DROP POLICY IF EXISTS "admin insert exercises" ON public.exercises;
CREATE POLICY "admin insert exercises"
  ON public.exercises FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_is_admin()));

DROP POLICY IF EXISTS "admin update exercises" ON public.exercises;
CREATE POLICY "admin update exercises"
  ON public.exercises FOR UPDATE TO authenticated
  USING ((SELECT public.get_is_admin()))
  WITH CHECK ((SELECT public.get_is_admin()));

-- The exercise-image policy was the other surviving direct profile-role check.
DROP POLICY IF EXISTS "admin manage exercise images" ON storage.objects;
CREATE POLICY "admin manage exercise images"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'exercises' AND (SELECT public.get_is_admin()))
  WITH CHECK (bucket_id = 'exercises' AND (SELECT public.get_is_admin()));
