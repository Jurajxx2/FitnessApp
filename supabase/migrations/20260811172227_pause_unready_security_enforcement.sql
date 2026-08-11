-- Compatibility gate for security work that was applied before its matching
-- clients, Edge Functions, secrets, and administrator MFA enrollment were
-- ready. Keep the additive audit/quota tables, but restore the previously
-- deployed behavior until each staged rollout reaches its enforcement gate.

-- The replacement cron currently has no Vault secret and the deployed v4
-- function still expects gateway JWT authentication. Pause it rather than
-- generating unauthenticated requests that can be mistaken for successful
-- reminder runs.
SELECT cron.unschedule('weekly-checkin-reminder')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-checkin-reminder'
);

-- The new check-in upload Edge Function and compatible web/mobile clients are
-- not deployed yet. Restore the existing direct-upload contract so current
-- clients continue to work. The final storage-hardening stage will replace
-- this only after every uploader emits the agreed bounded JPEG path/MIME.
UPDATE storage.buckets
SET file_size_limit = NULL,
    allowed_mime_types = NULL
WHERE id = 'check-in-photos';

DROP POLICY IF EXISTS "Users read own check-in photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own check-in photos" ON storage.objects;
DROP POLICY IF EXISTS "Users manage own check-in photos" ON storage.objects;

CREATE POLICY "Users manage own check-in photos"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'check-in-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'check-in-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- MFA enrollment and recovery have not been deployed to the admin portal.
-- Restore the prior central admin predicate so existing administrators are not
-- locked out. The later MFA enforcement migration must reintroduce the AAL2
-- claim check only after both administrators have verified factors.
CREATE OR REPLACE FUNCTION private.get_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT profile.is_admin
    FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
  ), false)
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
