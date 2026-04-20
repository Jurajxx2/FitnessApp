-- supabase/migrations/20260420000001_exercise_external_id.sql

-- 1. Add external_id and source_provider columns
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source_provider text DEFAULT 'manual';

-- 2. Create a unique index on external_id and source_provider to allow upserts
-- We only want uniqueness for imported exercises (where external_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_external_id_provider 
  ON exercises (external_id, source_provider) 
  WHERE external_id IS NOT NULL;

-- 3. Add a comment for clarity
COMMENT ON COLUMN exercises.external_id IS 'Unique identifier from the source provider (e.g., yuhonas slug)';
COMMENT ON COLUMN exercises.source_provider IS 'The name of the data source (e.g., yuhonas, manual)';
