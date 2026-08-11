-- The reservation table/RPCs introduced by 20260811171225 remain intentionally
-- dormant and service-role-only. This migration supersedes only the direct client
-- upload policies restored by 20260811172227; it does not widen reservation access.
-- Check-ins use the coach's Europe/Prague calendar week in both web and KMP.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'check-in-photos',
  'check-in-photos',
  false,
  5 * 1024 * 1024,
  ARRAY['image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users manage own check-in photos" ON storage.objects;
DROP POLICY IF EXISTS "Users read own check-in photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own check-in photos" ON storage.objects;
DROP POLICY IF EXISTS "Users create current-week check-in photos" ON storage.objects;
DROP POLICY IF EXISTS "Users replace current-week check-in photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete current-week check-in photos" ON storage.objects;

CREATE POLICY "Users read own check-in photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'check-in-photos'
    AND name ~ (
      '^' || (SELECT auth.uid())::text
      || '/checkin_[0-9]{4}-[0-9]{2}-[0-9]{2}_(front|side)[.]jpg$'
    )
  );

CREATE POLICY "Users create current-week check-in photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'check-in-photos'
    AND name ~ (
      '^' || (SELECT auth.uid())::text
      || '/checkin_[0-9]{4}-[0-9]{2}-[0-9]{2}_(front|side)[.]jpg$'
    )
    AND substring(name FROM '/checkin_([0-9]{4}-[0-9]{2}-[0-9]{2})_') =
      to_char(
        timezone('Europe/Prague', now())::date
          - (extract(isodow FROM timezone('Europe/Prague', now()))::integer - 1),
        'YYYY-MM-DD'
      )
  );

CREATE POLICY "Users replace current-week check-in photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'check-in-photos'
    AND name ~ (
      '^' || (SELECT auth.uid())::text
      || '/checkin_[0-9]{4}-[0-9]{2}-[0-9]{2}_(front|side)[.]jpg$'
    )
    AND substring(name FROM '/checkin_([0-9]{4}-[0-9]{2}-[0-9]{2})_') =
      to_char(
        timezone('Europe/Prague', now())::date
          - (extract(isodow FROM timezone('Europe/Prague', now()))::integer - 1),
        'YYYY-MM-DD'
      )
  )
  WITH CHECK (
    bucket_id = 'check-in-photos'
    AND name ~ (
      '^' || (SELECT auth.uid())::text
      || '/checkin_[0-9]{4}-[0-9]{2}-[0-9]{2}_(front|side)[.]jpg$'
    )
    AND substring(name FROM '/checkin_([0-9]{4}-[0-9]{2}-[0-9]{2})_') =
      to_char(
        timezone('Europe/Prague', now())::date
          - (extract(isodow FROM timezone('Europe/Prague', now()))::integer - 1),
        'YYYY-MM-DD'
      )
  );

CREATE POLICY "Users delete current-week check-in photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'check-in-photos'
    AND name ~ (
      '^' || (SELECT auth.uid())::text
      || '/checkin_[0-9]{4}-[0-9]{2}-[0-9]{2}_(front|side)[.]jpg$'
    )
    AND substring(name FROM '/checkin_([0-9]{4}-[0-9]{2}-[0-9]{2})_') =
      to_char(
        timezone('Europe/Prague', now())::date
          - (extract(isodow FROM timezone('Europe/Prague', now()))::integer - 1),
        'YYYY-MM-DD'
      )
  );
