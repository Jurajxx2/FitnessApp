-- supabase/migrations/20260526000000_exercise_favorites.sql

CREATE TABLE exercise_favorites (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, exercise_id)
);

ALTER TABLE exercise_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own exercise favorites"
    ON exercise_favorites FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_exercise_favorites_user ON exercise_favorites(user_id);
