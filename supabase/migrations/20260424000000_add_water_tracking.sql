-- supabase/migrations/20260424000000_add_water_tracking.sql

CREATE TABLE water_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_ml   INTEGER NOT NULL,
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own water logs"
    ON water_logs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_water_logs_user_date ON water_logs(user_id, logged_at DESC);

-- ─────────────────────────────────────────────────────────────

CREATE TABLE hydration_settings (
    user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    interval_minutes  INTEGER NOT NULL DEFAULT 120,
    start_hour        INTEGER NOT NULL DEFAULT 7,
    end_hour          INTEGER NOT NULL DEFAULT 22,
    smart_suppress    BOOLEAN NOT NULL DEFAULT TRUE,
    reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hydration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own hydration settings"
    ON hydration_settings FOR ALL USING (auth.uid() = user_id);
