-- Reviewed template for the final administrator MFA enforcement migration.
-- At activation time, create a fresh migration with `supabase migration new`
-- and copy this SQL into it. Keeping this template outside migrations prevents
-- a normal prerequisite push from enforcing AAL2 before functions and admin
-- enrollment have been deployed and rehearsed.
--
-- DEPLOYMENT GATE: keep this migration pending until every administrator has
-- verified TOTP enrollment and the MFA UI plus both administrator Edge
-- Functions from this branch are deployed. Applying it before that gate will
-- intentionally remove administrator access from aal1 sessions.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Human administrator authority always comes from the current profile row and
-- the verified JWT assurance level. The service-role branch is retained for
-- non-user maintenance callers; it already bypasses RLS and cannot complete an
-- MFA ceremony. No app_metadata or user_metadata claim grants admin access.
CREATE OR REPLACE FUNCTION private.get_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN COALESCE((SELECT auth.role()), '') = 'service_role' THEN true
    WHEN COALESCE((SELECT auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' THEN false
    ELSE COALESCE((
      SELECT profile.is_admin AND NOT profile.is_blocked
      FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid())
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

-- Replace the two original exercise mutation policies that trusted a mutable,
-- stale app_metadata role claim. Athlete SELECT policies are not changed.
DROP POLICY IF EXISTS "admin insert exercises" ON public.exercises;
CREATE POLICY "admin insert exercises"
  ON public.exercises FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_is_admin()));

DROP POLICY IF EXISTS "admin update exercises" ON public.exercises;
CREATE POLICY "admin update exercises"
  ON public.exercises FOR UPDATE TO authenticated
  USING ((SELECT public.get_is_admin()))
  WITH CHECK ((SELECT public.get_is_admin()));
