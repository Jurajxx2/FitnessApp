-- supabase/migrations/20260420000003_storage_policies.sql

-- Allow authenticated users with admin status to manage exercise images
-- We use a check on the profiles table for is_admin

-- Create policies for storage.objects if they don't already cover this
-- Note: 'authenticated' users can only write if they are admins

CREATE POLICY "admin manage exercise images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'exercises' 
    AND (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
  )
  WITH CHECK (
    bucket_id = 'exercises' 
    AND (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
  );
