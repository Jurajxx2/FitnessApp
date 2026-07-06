-- supabase/migrations/20260707100100_check_in_photos_bucket.sql
-- Private bucket for weekly check-in progress photos (front/side).
-- Path convention: {user_id}/checkin_{week}_{slot}.jpg

INSERT INTO storage.buckets (id, name, public)
VALUES ('check-in-photos', 'check-in-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Owner can manage files under their own {user_id}/ folder.
CREATE POLICY "Users manage own check-in photos"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'check-in-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'check-in-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Admin/coach can read any check-in photo (to review + sign URLs).
CREATE POLICY "Admin reads check-in photos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'check-in-photos' AND get_is_admin());
