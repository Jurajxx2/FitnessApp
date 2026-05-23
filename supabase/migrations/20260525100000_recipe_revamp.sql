-- 1. Align recipes table with Kotlin domain.
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS cook_time_min INTEGER,
  ADD COLUMN IF NOT EXISTS difficulty    TEXT CHECK (difficulty IN ('easy','medium','hard') OR difficulty IS NULL),
  ADD COLUMN IF NOT EXISTS tags          TEXT[] DEFAULT '{}';

-- 2. Structured preparation steps.
CREATE TABLE IF NOT EXISTS recipe_steps (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id    UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_number  INTEGER NOT NULL,
  instruction  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (recipe_id, step_number)
);

ALTER TABLE recipe_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read recipe steps"
  ON recipe_steps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin manages recipe steps"
  ON recipe_steps FOR ALL
  TO authenticated
  USING (get_is_admin());

CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe
  ON recipe_steps(recipe_id, step_number);
