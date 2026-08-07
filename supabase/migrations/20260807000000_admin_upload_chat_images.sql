-- Coaches reply with photos from the admin chat panel. The upload lands under
-- the athlete's storage prefix (<athleteUserId>/coach_....), not the coach's
-- own uid, so the existing chat_images_insert policy (which requires
-- auth.uid()::text = (storage.foldername(name))[1]) denies it. Admins already
-- have SELECT via "Admins read chat images"; this adds the matching INSERT.
DROP POLICY IF EXISTS "Admins can upload chat images" ON storage.objects;

CREATE POLICY "Admins can upload chat images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images' AND (SELECT public.get_is_admin()));
