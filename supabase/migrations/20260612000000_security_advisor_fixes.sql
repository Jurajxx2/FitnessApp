-- Fixes for Supabase security advisor warnings (2026-06-12)

-- 1. Pin search_path on trigger function (advisor: function_search_path_mutable).
--    Body only uses now() from pg_catalog, so an empty search_path is safe.
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- 2. Lock down SECURITY DEFINER functions (advisors: anon/authenticated_security_definer_function_executable).
--    get_is_admin() is used inside RLS policies evaluated as the signed-in user,
--    so authenticated must keep EXECUTE; anon never needs it.
REVOKE EXECUTE ON FUNCTION public.get_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_is_admin() TO authenticated;

--    handle_new_user() is only invoked by the auth.users trigger; no API role needs it.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3. Public buckets are served via public object URLs, which do not use RLS SELECT
--    policies. The broad SELECT policies only enabled clients to LIST all files
--    (advisor: public_bucket_allows_listing). No app code lists these buckets.
DROP POLICY IF EXISTS "authenticated read exercises bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for recipe photos" ON storage.objects;
