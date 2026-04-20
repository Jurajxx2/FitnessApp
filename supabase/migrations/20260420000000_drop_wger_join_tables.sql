-- supabase/migrations/20260420000000_drop_wger_join_tables.sql

-- 1. Add flat text array columns to exercises
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS primary_muscles   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_muscles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipment_names   text[] NOT NULL DEFAULT '{}';

-- 2. Remove wger-specific columns
ALTER TABLE exercises         DROP COLUMN IF EXISTS wger_id;
ALTER TABLE workout_exercises DROP COLUMN IF EXISTS wger_exercise_id;

-- 3. Drop join tables (cascade handles FK refs)
DROP TABLE IF EXISTS exercise_muscles  CASCADE;
DROP TABLE IF EXISTS exercise_equipment CASCADE;

-- 4. Drop wger lookup tables
DROP TABLE IF EXISTS muscles   CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;

-- 5. Indexes for array containment queries
CREATE INDEX IF NOT EXISTS idx_exercises_primary_muscles   ON exercises USING gin(primary_muscles);
CREATE INDEX IF NOT EXISTS idx_exercises_secondary_muscles ON exercises USING gin(secondary_muscles);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment_names   ON exercises USING gin(equipment_names);
