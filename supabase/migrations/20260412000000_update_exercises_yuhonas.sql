-- supabase/migrations/20260412000000_update_exercises_yuhonas.sql

-- Add new columns for more detailed exercise info
alter table exercises 
  add column if not exists "force" text,
  add column if not exists "mechanic" text;

-- Ensure categories used by yuhonas are present
insert into exercise_categories (id, name)
values 
  (10, 'Strength'),
  (11, 'Core & Mobility'),
  (12, 'Cardio')
on conflict (id) do update set name = excluded.name;

-- Note: We are keeping name_en, name_cs, etc. as columns for now for simplicity,
-- but we could move to a more generic translation table later if needed.
-- For the MVP, this flat structure is faster.
