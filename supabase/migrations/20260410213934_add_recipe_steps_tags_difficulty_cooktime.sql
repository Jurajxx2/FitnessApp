ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS steps         JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cook_time_min INTEGER,
  ADD COLUMN IF NOT EXISTS tags          JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS difficulty    TEXT CHECK (difficulty IN ('easy', 'medium', 'hard'));