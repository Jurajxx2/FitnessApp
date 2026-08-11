-- Contract phase for moving coach-only notes out of public.profiles.
--
-- Deployment is intentionally gated on the admin web cutover at 552f5e5 being
-- live and verified. The compatibility column cannot be removed while an old
-- web build can still select or write profiles.admin_notes.

-- Supabase's linked migration runner rejects a top-level LOCK TABLE because it
-- is not in an explicit transaction block. Keep the destructive cutover in one
-- DO statement instead. DROP TRIGGER obtains the profiles DDL lock; if a later
-- assertion or DDL statement fails, PostgreSQL rolls the entire DO statement
-- back, including the trigger drop.
DO $cleanup$
DECLARE
  mismatched_legacy_note_count BIGINT;
BEGIN
  EXECUTE
    'DROP TRIGGER sync_athlete_admin_note_from_profile ON public.profiles';

  -- Abort while the profiles lock is held unless every populated legacy value
  -- has an exactly matching row in the separated table. A NULL legacy value is
  -- not a source of truth and does not invalidate a newer separated note.
  SELECT count(*)
  INTO mismatched_legacy_note_count
  FROM public.profiles AS profile
  LEFT JOIN public.athlete_admin_notes AS admin_note
    ON admin_note.profile_id = profile.id
  WHERE profile.admin_notes IS NOT NULL
    AND admin_note.notes IS DISTINCT FROM profile.admin_notes;

  IF mismatched_legacy_note_count <> 0 THEN
    RAISE EXCEPTION
      'cannot remove profiles.admin_notes: % populated legacy note(s) do not match athlete_admin_notes',
      mismatched_legacy_note_count
      USING ERRCODE = '23514';
  END IF;

  -- Keep the public PostgREST contract unchanged. Only the coach-note storage
  -- owner changes: ordinary profile fields stay on profiles, while
  -- p_admin_notes writes exclusively to athlete_admin_notes.
  EXECUTE $rpc$
    CREATE OR REPLACE FUNCTION public.admin_update_athlete_profile(
      p_user_id UUID,
      p_full_name TEXT,
      p_age INTEGER,
      p_height_cm REAL,
      p_weight_kg REAL,
      p_goal TEXT,
      p_activity_level TEXT,
      p_onboarding_complete BOOLEAN,
      p_access_mode TEXT,
      p_admin_notes TEXT
    )
    RETURNS UUID
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = ''
    AS $body$
    DECLARE
      normalized_admin_notes TEXT := NULLIF(btrim(p_admin_notes), '');
    BEGIN
      IF NOT (SELECT public.get_is_admin()) THEN
        RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
      END IF;
      IF p_age IS NOT NULL AND p_age NOT BETWEEN 13 AND 120 THEN
        RAISE EXCEPTION 'age must be between 13 and 120' USING ERRCODE = '22023';
      END IF;
      IF p_height_cm IS NOT NULL AND p_height_cm NOT BETWEEN 50 AND 260 THEN
        RAISE EXCEPTION 'height is outside the supported range' USING ERRCODE = '22023';
      END IF;
      IF p_weight_kg IS NOT NULL AND p_weight_kg NOT BETWEEN 20 AND 500 THEN
        RAISE EXCEPTION 'weight is outside the supported range' USING ERRCODE = '22023';
      END IF;
      IF p_goal IS NOT NULL AND p_goal NOT IN ('build_muscle', 'lose_weight', 'stay_fit', 'get_stronger') THEN
        RAISE EXCEPTION 'goal is invalid' USING ERRCODE = '22023';
      END IF;
      IF p_activity_level IS NOT NULL AND p_activity_level NOT IN ('sedentary', 'lightly_active', 'moderately_active', 'active', 'very_active') THEN
        RAISE EXCEPTION 'activity level is invalid' USING ERRCODE = '22023';
      END IF;
      IF p_access_mode NOT IN ('nutrition', 'activity', 'both') THEN
        RAISE EXCEPTION 'access mode is invalid' USING ERRCODE = '22023';
      END IF;

      UPDATE public.profiles
      SET full_name = NULLIF(btrim(p_full_name), ''),
          age = p_age,
          height_cm = p_height_cm,
          weight_kg = p_weight_kg,
          goal = p_goal,
          activity_level = p_activity_level,
          onboarding_complete = COALESCE(p_onboarding_complete, false),
          access_mode = p_access_mode,
          updated_at = now()
      WHERE id = p_user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'user % does not exist', p_user_id USING ERRCODE = 'P0002';
      END IF;

      IF normalized_admin_notes IS NULL THEN
        DELETE FROM public.athlete_admin_notes
        WHERE profile_id = p_user_id;
      ELSE
        INSERT INTO public.athlete_admin_notes (
          profile_id,
          notes,
          updated_by
        )
        VALUES (
          p_user_id,
          normalized_admin_notes,
          (SELECT auth.uid())
        )
        ON CONFLICT (profile_id) DO UPDATE
        SET notes = EXCLUDED.notes,
            updated_by = EXCLUDED.updated_by,
            updated_at = now();
      END IF;

      RETURN p_user_id;
    END;
    $body$;
  $rpc$;

  EXECUTE
    'DROP FUNCTION private.sync_athlete_admin_note_from_profile()';
  EXECUTE
    'ALTER TABLE public.profiles DROP COLUMN admin_notes';
END
$cleanup$;

-- CREATE OR REPLACE preserves the existing ACL. Reassert the intended
-- PostgREST roles so the final contract is explicit and reviewable.
REVOKE ALL ON FUNCTION public.admin_update_athlete_profile(
  UUID, TEXT, INTEGER, REAL, REAL, TEXT, TEXT, BOOLEAN, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_athlete_profile(
  UUID, TEXT, INTEGER, REAL, REAL, TEXT, TEXT, BOOLEAN, TEXT, TEXT
) TO authenticated, service_role;
