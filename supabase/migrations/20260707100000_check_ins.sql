-- supabase/migrations/20260707100000_check_ins.sql
-- Weekly check-in (F7): athlete-submitted weekly form + coach text response.

CREATE TABLE check_ins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    week_of             DATE NOT NULL,                 -- Monday of the check-in week
    weight_kg           REAL,
    energy_level        SMALLINT CHECK (energy_level        BETWEEN 1 AND 5),
    sleep_quality       SMALLINT CHECK (sleep_quality       BETWEEN 1 AND 5),
    stress_level        SMALLINT CHECK (stress_level        BETWEEN 1 AND 5),
    training_adherence  SMALLINT CHECK (training_adherence  BETWEEN 0 AND 14),  -- sessions completed
    nutrition_adherence SMALLINT CHECK (nutrition_adherence BETWEEN 1 AND 5),
    notes               TEXT,
    photo_front_path    TEXT,     -- object path in the private 'check-in-photos' bucket
    photo_side_path     TEXT,
    coach_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
    coach_response      TEXT,
    coach_response_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_of)
);

CREATE INDEX idx_check_ins_user_week ON check_ins(user_id, week_of DESC);

-- set_updated_at() already exists globally (defined in 20260424000000_add_water_tracking.sql)
CREATE TRIGGER handle_check_ins_updated_at
    BEFORE UPDATE ON check_ins
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- Athlete: full control over own rows. Admin/coach: read-only.
CREATE POLICY "Users read own check-ins"
    ON check_ins FOR SELECT TO authenticated
    USING (get_is_admin() OR auth.uid() = user_id);

CREATE POLICY "Users insert own check-ins"
    ON check_ins FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own check-ins"
    ON check_ins FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admin/coach: write coach_response fields only (separate UPDATE policy).
CREATE POLICY "Admin responds to check-ins"
    ON check_ins FOR UPDATE TO authenticated
    USING (get_is_admin())
    WITH CHECK (get_is_admin());
