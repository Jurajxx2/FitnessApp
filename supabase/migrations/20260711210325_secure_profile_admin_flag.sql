-- Admin access is stored on profiles, so the value must not be writable by
-- the user who owns that profile. This is required before using get_is_admin
-- as the authorization boundary for server-side admin actions.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.profile_admin_flag_is_unchanged(
  p_profile_id UUID,
  p_is_admin BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_profile_id
      AND p.is_admin IS NOT DISTINCT FROM p_is_admin
      AND (
        p_profile_id = (SELECT auth.uid())
        OR (SELECT public.get_is_admin())
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION private.profile_admin_flag_is_unchanged(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.profile_admin_flag_is_unchanged(UUID, BOOLEAN) TO authenticated;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Coach can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND private.profile_admin_flag_is_unchanged(id, is_admin)
  );

CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT public.get_is_admin()))
  WITH CHECK (
    (SELECT public.get_is_admin())
    AND private.profile_admin_flag_is_unchanged(id, is_admin)
  );
