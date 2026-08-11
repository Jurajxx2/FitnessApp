-- Expansion phase for moving coach-only notes out of public.profiles.
--
-- Keep profiles.admin_notes and dual-write it from the existing RPC until the
-- admin web client has switched to the new table. A later, separately deployed
-- cutover may remove the legacy column after compatibility has been verified.

CREATE TABLE public.athlete_admin_notes (
  profile_id UUID PRIMARY KEY
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes TEXT NOT NULL,
  updated_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PostgreSQL does not index foreign-key columns automatically. profile_id is
-- already covered by the primary key; updated_by needs its own index so profile
-- deletion does not scan the notes table.
CREATE INDEX athlete_admin_notes_updated_by_idx
  ON public.athlete_admin_notes(updated_by);

CREATE TRIGGER handle_athlete_admin_notes_updated_at
  BEFORE UPDATE ON public.athlete_admin_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.athlete_admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage athlete admin notes"
  ON public.athlete_admin_notes
  FOR ALL
  TO authenticated
  USING ((SELECT public.get_is_admin()))
  WITH CHECK ((SELECT public.get_is_admin()));

REVOKE ALL ON TABLE public.athlete_admin_notes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.athlete_admin_notes
  TO authenticated, service_role;

-- Keep writes through the legacy profiles.admin_notes column synchronized.
-- Creating this trigger before the backfill closes both migration-runner cases:
-- transactional DDL holds the trigger's table lock through commit, while an
-- autocommit runner makes the trigger visible before the backfill starts.
CREATE OR REPLACE FUNCTION private.sync_athlete_admin_note_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Null profile creation and updates that leave the legacy value unchanged do
  -- not need synchronization and must remain available to normal profile flows.
  IF TG_OP = 'INSERT' AND NEW.admin_notes IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.admin_notes IS NOT DISTINCT FROM OLD.admin_notes THEN
    RETURN NEW;
  END IF;

  -- Every remaining path creates, changes, or clears coach-only data.
  IF NOT (SELECT public.get_is_admin()) THEN
    RAISE EXCEPTION 'admin access required to change coach notes'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.admin_notes IS NULL THEN
    DELETE FROM public.athlete_admin_notes
    WHERE profile_id = NEW.id;
  ELSE
    INSERT INTO public.athlete_admin_notes (
      profile_id,
      notes,
      updated_by
    )
    VALUES (
      NEW.id,
      NEW.admin_notes,
      (SELECT auth.uid())
    )
    ON CONFLICT (profile_id) DO UPDATE
    SET notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_athlete_admin_note_from_profile()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER sync_athlete_admin_note_from_profile
  AFTER INSERT OR UPDATE OF admin_notes ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_athlete_admin_note_from_profile();

INSERT INTO public.athlete_admin_notes (profile_id, notes, updated_by)
SELECT
  profile.id,
  profile.admin_notes,
  NULL
FROM public.profiles AS profile
WHERE profile.admin_notes IS NOT NULL
ON CONFLICT (profile_id) DO NOTHING;

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
AS $$
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
      admin_notes = normalized_admin_notes,
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
$$;

REVOKE ALL ON FUNCTION public.admin_update_athlete_profile(
  UUID, TEXT, INTEGER, REAL, REAL, TEXT, TEXT, BOOLEAN, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_athlete_profile(
  UUID, TEXT, INTEGER, REAL, REAL, TEXT, TEXT, BOOLEAN, TEXT, TEXT
) TO authenticated, service_role;
