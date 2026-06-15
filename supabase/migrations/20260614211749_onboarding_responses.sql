-- Onboarding quiz answers: one row per user, plus a raw JSONB snapshot for forward-compat.
CREATE TABLE onboarding_responses (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gender              TEXT,
  goal                TEXT,
  experience_level    TEXT,
  focus_areas         TEXT[]  NOT NULL DEFAULT '{}',
  frequency_per_week  INT,
  equipment           TEXT,
  age                 INT,
  height_cm           REAL,
  weight_kg           REAL,
  use_metric          BOOLEAN NOT NULL DEFAULT true,
  training_preference TEXT,
  name                TEXT,
  bmi                 REAL,
  raw                 JSONB,
  completed_at        TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own onboarding responses"
  ON onboarding_responses FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read onboarding responses"
  ON onboarding_responses FOR SELECT
  TO authenticated
  USING (get_is_admin());

-- Goal taxonomy migration for any existing profiles rows (table is currently empty; defensive).
UPDATE profiles SET goal = 'lose_weight'  WHERE goal = 'weight_loss';
UPDATE profiles SET goal = 'build_muscle' WHERE goal = 'muscle_gain';
UPDATE profiles SET goal = NULL           WHERE goal = 'mental_strength';
