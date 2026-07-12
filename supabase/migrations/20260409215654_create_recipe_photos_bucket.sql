-- Create recipe-photos storage bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-photos',
  'recipe-photos',
  true,
  5242880,  -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/update/delete their own uploads
CREATE POLICY "Authenticated users can upload recipe photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recipe-photos');

CREATE POLICY "Authenticated users can update recipe photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'recipe-photos');

CREATE POLICY "Authenticated users can delete recipe photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'recipe-photos');

-- Public read access
CREATE POLICY "Public read access for recipe photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'recipe-photos');