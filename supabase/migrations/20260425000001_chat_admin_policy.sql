-- Allow admin users to read and write all human chat messages.
-- The existing "users_own_messages" policy remains; RLS policies OR-combine.
CREATE POLICY "admins_all_messages"
  ON chat_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );
