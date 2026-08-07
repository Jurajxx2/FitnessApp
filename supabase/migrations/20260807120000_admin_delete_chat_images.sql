-- sendImage (admin/src/pages/admin/Chat.tsx) uploads the coach's photo to
-- Storage before inserting the chat_messages row. If that insert fails, the
-- upload is now cleaned up best-effort — but the cleanup can only succeed if
-- admins are allowed to delete from the bucket. Admins already have INSERT
-- via "Admins can upload chat images"; this adds the matching DELETE, scoped
-- identically (same bucket condition, same admin predicate).
DROP POLICY IF EXISTS "Admins can delete chat images" ON storage.objects;

CREATE POLICY "Admins can delete chat images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-images' AND (SELECT public.get_is_admin()));
