-- supabase/migrations/20260420000002_exercise_fts.sql

-- 1. Create a generated column for full-text search
-- It indexes name_en, name_cs, description_en, description_cs
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name_en, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description_en, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(name_cs, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description_cs, '')), 'B')
  ) STORED;

-- 2. Create a GIN index for the search vector
CREATE INDEX IF NOT EXISTS idx_exercises_search_vector ON exercises USING gin(search_vector);

-- 3. Add a comment
COMMENT ON COLUMN exercises.search_vector IS 'Generated tsvector for full-text search in EN/CS';
