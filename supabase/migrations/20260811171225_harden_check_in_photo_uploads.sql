-- Check-in photos contain sensitive health data. Direct client writes are
-- replaced by a bounded Edge Function that validates content and reserves
-- per-user usage atomically before using the service role for Storage.

UPDATE storage.buckets
SET public = false,
    file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png']::TEXT[]
WHERE id = 'check-in-photos';

DROP POLICY IF EXISTS "Users manage own check-in photos" ON storage.objects;
DROP POLICY IF EXISTS "Users read own check-in photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own check-in photos" ON storage.objects;

CREATE POLICY "Users read own check-in photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'check-in-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );

CREATE POLICY "Users delete own check-in photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'check-in-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );

CREATE TABLE private.check_in_photo_upload_reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_path    TEXT NOT NULL CHECK (char_length(object_path) BETWEEN 1 AND 300),
  new_bytes      BIGINT NOT NULL CHECK (new_bytes BETWEEN 1 AND 8388608),
  replaced_bytes BIGINT NOT NULL DEFAULT 0 CHECK (replaced_bytes >= 0),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finished_at    TIMESTAMPTZ
);

CREATE INDEX check_in_photo_upload_reservations_user_requested
  ON private.check_in_photo_upload_reservations(user_id, requested_at DESC);
CREATE INDEX check_in_photo_upload_reservations_pending
  ON private.check_in_photo_upload_reservations(user_id, requested_at)
  WHERE status = 'pending';

REVOKE ALL ON private.check_in_photo_upload_reservations FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.check_in_photo_upload_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_check_in_photo_upload(
  p_user_id UUID,
  p_object_path TEXT,
  p_bytes BIGINT
)
RETURNS TABLE(reservation_id UUID, denial_reason TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  reservation_time TIMESTAMPTZ := clock_timestamp();
  current_storage_bytes BIGINT;
  pending_delta_bytes BIGINT;
  existing_object_bytes BIGINT;
  new_reservation_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_object_path IS NULL OR p_bytes IS NULL
    OR p_bytes < 1 OR p_bytes > 8388608
    OR p_object_path !~ ('^' || p_user_id::TEXT || '/checkin_[0-9]{4}-[0-9]{2}-[0-9]{2}_(front|side)\.(jpg|png)$')
  THEN
    RAISE EXCEPTION 'invalid check-in photo reservation' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('check_in_photo_upload:' || p_user_id::TEXT, 0)
  );

  UPDATE private.check_in_photo_upload_reservations
  SET status = 'failed', finished_at = reservation_time
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND requested_at < reservation_time - INTERVAL '10 minutes';

  DELETE FROM private.check_in_photo_upload_reservations
  WHERE user_id = p_user_id
    AND requested_at < reservation_time - INTERVAL '30 days';

  IF (
    SELECT count(*) FROM private.check_in_photo_upload_reservations
    WHERE user_id = p_user_id AND requested_at >= reservation_time - INTERVAL '1 minute'
  ) >= 3 OR (
    SELECT count(*) FROM private.check_in_photo_upload_reservations
    WHERE user_id = p_user_id AND requested_at >= reservation_time - INTERVAL '24 hours'
  ) >= 20 THEN
    RETURN QUERY SELECT NULL::UUID, 'rate'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE((metadata->>'size')::BIGINT, 0)
  INTO existing_object_bytes
  FROM storage.objects
  WHERE bucket_id = 'check-in-photos' AND name = p_object_path;
  existing_object_bytes := COALESCE(existing_object_bytes, 0);

  SELECT COALESCE(sum((metadata->>'size')::BIGINT), 0)
  INTO current_storage_bytes
  FROM storage.objects
  WHERE bucket_id = 'check-in-photos'
    AND (storage.foldername(name))[1] = p_user_id::TEXT;

  SELECT COALESCE(sum(GREATEST(new_bytes - replaced_bytes, 0)), 0)
  INTO pending_delta_bytes
  FROM private.check_in_photo_upload_reservations
  WHERE user_id = p_user_id AND status = 'pending';

  IF current_storage_bytes + pending_delta_bytes + GREATEST(p_bytes - existing_object_bytes, 0) > 524288000 THEN
    RETURN QUERY SELECT NULL::UUID, 'storage'::TEXT;
    RETURN;
  END IF;

  INSERT INTO private.check_in_photo_upload_reservations(
    user_id, object_path, new_bytes, replaced_bytes, requested_at
  ) VALUES (
    p_user_id, p_object_path, p_bytes, existing_object_bytes, reservation_time
  ) RETURNING id INTO new_reservation_id;

  RETURN QUERY SELECT new_reservation_id, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_check_in_photo_upload(UUID, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_check_in_photo_upload(UUID, TEXT, BIGINT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.finish_check_in_photo_upload(
  p_reservation_id UUID,
  p_succeeded BOOLEAN
)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE private.check_in_photo_upload_reservations
  SET status = CASE WHEN p_succeeded THEN 'succeeded' ELSE 'failed' END,
      finished_at = clock_timestamp()
  WHERE id = p_reservation_id AND status = 'pending'
$$;

REVOKE ALL ON FUNCTION public.finish_check_in_photo_upload(UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_check_in_photo_upload(UUID, BOOLEAN)
  TO service_role;
