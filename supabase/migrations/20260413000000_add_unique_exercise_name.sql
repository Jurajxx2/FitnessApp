-- supabase/migrations/20260413000000_add_unique_exercise_name.sql

-- Add a unique constraint to name_en to allow for upsert based on name
-- This is required by the ImportExercisesModal sync logic
alter table exercises 
  add constraint exercises_name_en_key unique (name_en);
