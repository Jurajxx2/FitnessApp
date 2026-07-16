-- Chat attachments remain private. Their owners can read their own folder via
-- chat_images_select; coaches need SELECT to create signed URLs when reviewing
-- a conversation in the admin workspace.
CREATE POLICY "Admins read chat images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-images' AND (SELECT public.get_is_admin()));
