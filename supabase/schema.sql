-- ============================================================
-- Coach Foška — Supabase Schema
-- Run this in the Supabase SQL Editor after creating the project
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email         TEXT NOT NULL,
    full_name     TEXT,
    age           INTEGER,
    height_cm     REAL,
    weight_kg     REAL,
    goal          TEXT,          -- 'weight_loss' | 'muscle_gain' | 'mental_strength'
    activity_level TEXT,         -- 'sedentary' | 'lightly_active' | 'moderately_active' | 'active' | 'very_active'
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- WEIGHT ENTRIES
-- ============================================================
CREATE TABLE weight_entries (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weight_kg     REAL NOT NULL,
    recorded_at   DATE NOT NULL DEFAULT CURRENT_DATE,
    notes         TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own weight entries"
    ON weight_entries FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- COACH-ASSIGNED WORKOUTS
-- ============================================================
CREATE TABLE workouts (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id      UUID REFERENCES auth.users(id),
    user_id       UUID REFERENCES auth.users(id),  -- NULL = applies to all users
    name          TEXT NOT NULL,
    day_of_week   INTEGER,  -- 0=Monday .. 6=Sunday, NULL = no specific day
    duration_minutes INTEGER DEFAULT 0,
    notes         TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read assigned workouts"
    ON workouts FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can manage workouts"
    ON workouts FOR ALL
    USING (auth.uid() = coach_id);

-- ============================================================
-- WORKOUT EXERCISES
-- ============================================================
CREATE TABLE workout_exercises (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id      UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    muscle_group    TEXT,
    sets            INTEGER DEFAULT 3,
    reps            TEXT DEFAULT '10',
    rest_seconds    INTEGER DEFAULT 60,
    tips            TEXT,
    wger_exercise_id INTEGER,  -- Reference to WGER exercise API
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read exercises for accessible workouts"
    ON workout_exercises FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workouts w
            WHERE w.id = workout_id
            AND (w.user_id = auth.uid() OR w.user_id IS NULL)
        )
    );

CREATE POLICY "Admins can manage workout exercises"
    ON workout_exercises FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workouts w
            WHERE w.id = workout_id
            AND w.coach_id = auth.uid()
        )
    );

-- ============================================================
-- USER WORKOUT LOGS
-- ============================================================
CREATE TABLE workout_logs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workout_id       UUID REFERENCES workouts(id),
    workout_name     TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 0,
    notes            TEXT,
    logged_at        TIMESTAMPTZ DEFAULT now(),
    created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own workout logs"
    ON workout_logs FOR ALL USING (auth.uid() = user_id);

CREATE TABLE exercise_logs (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_log_id    UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
    exercise_name     TEXT NOT NULL,
    sets_completed    INTEGER DEFAULT 0,
    reps_completed    TEXT,
    weight_kg         REAL,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own exercise logs"
    ON exercise_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workout_logs wl
            WHERE wl.id = workout_log_id
            AND wl.user_id = auth.uid()
        )
    );

-- ============================================================
-- COACH-ASSIGNED MEAL PLANS
-- ============================================================
CREATE TABLE meal_plans (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id      UUID REFERENCES auth.users(id),
    user_id       UUID REFERENCES auth.users(id),  -- NULL = template for all
    name          TEXT NOT NULL,
    description   TEXT,
    valid_from    DATE,
    valid_to      DATE,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read assigned meal plans"
    ON meal_plans FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can manage meal plans"
    ON meal_plans FOR ALL
    USING (auth.uid() = coach_id);

CREATE TABLE meals (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_plan_id  UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    time_of_day   TEXT,  -- e.g. '08:00'
    sort_order    INTEGER DEFAULT 0
);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read meals for accessible plans"
    ON meals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM meal_plans mp
            WHERE mp.id = meal_plan_id
            AND (mp.user_id = auth.uid() OR mp.user_id IS NULL)
        )
    );

CREATE POLICY "Admins can manage meals"
    ON meals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM meal_plans mp
            WHERE mp.id = meal_plan_id
            AND mp.coach_id = auth.uid()
        )
    );

CREATE TABLE meal_foods (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_id         UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    amount_grams    REAL DEFAULT 100,
    calories        REAL DEFAULT 0,
    protein_g       REAL DEFAULT 0,
    carbs_g         REAL DEFAULT 0,
    fat_g           REAL DEFAULT 0
);

ALTER TABLE meal_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read meal foods for accessible plans"
    ON meal_foods FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM meals m
            JOIN meal_plans mp ON mp.id = m.meal_plan_id
            WHERE m.id = meal_id
            AND (mp.user_id = auth.uid() OR mp.user_id IS NULL)
        )
    );

CREATE POLICY "Admins can manage meal foods"
    ON meal_foods FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM meals m
            JOIN meal_plans mp ON mp.id = m.meal_plan_id
            WHERE m.id = meal_id
            AND mp.coach_id = auth.uid()
        )
    );

-- ============================================================
-- USER MEAL LOGS (user tracking)
-- ============================================================
CREATE TABLE meal_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_name     TEXT NOT NULL,
    notes         TEXT,
    logged_at     TIMESTAMPTZ DEFAULT now(),
    created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meal logs"
    ON meal_logs FOR ALL USING (auth.uid() = user_id);

CREATE TABLE meal_log_foods (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_log_id     UUID NOT NULL REFERENCES meal_logs(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    amount_grams    REAL DEFAULT 100,
    calories        REAL DEFAULT 0,
    protein_g       REAL DEFAULT 0,
    carbs_g         REAL DEFAULT 0,
    fat_g           REAL DEFAULT 0
);

ALTER TABLE meal_log_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meal log foods"
    ON meal_log_foods FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM meal_logs ml
            WHERE ml.id = meal_log_id
            AND ml.user_id = auth.uid()
        )
    );

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_weight_entries_user_date ON weight_entries(user_id, recorded_at DESC);
CREATE INDEX idx_workout_logs_user_date ON workout_logs(user_id, logged_at DESC);
CREATE INDEX idx_meal_logs_user_date ON meal_logs(user_id, logged_at DESC);
CREATE INDEX idx_workouts_user ON workouts(user_id);
CREATE INDEX idx_meal_plans_user ON meal_plans(user_id);
