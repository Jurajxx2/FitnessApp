-- supabase/migrations/20260526100000_recipe_favorites.sql

CREATE TABLE recipe_favorites (
    user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, recipe_id)
);

ALTER TABLE recipe_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recipe favorites"
    ON recipe_favorites FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
