-- supabase/migrations/20260410000000_exercises.sql

create table exercise_categories (
  id   int primary key,
  name text not null
);

create table muscles (
  id       int primary key,
  name     text not null,
  is_front bool not null default true
);

create table equipment (
  id   int primary key,
  name text not null
);

create table exercises (
  id              uuid primary key default gen_random_uuid(),
  name_en         text not null,
  description_en  text not null default '',
  name_cs         text,
  description_cs  text,
  category_id     int references exercise_categories(id),
  image_url       text,
  video_url       text,
  difficulty      text,
  is_active       bool not null default true,
  wger_id         int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table exercise_muscles (
  exercise_id uuid not null references exercises(id) on delete cascade,
  muscle_id   int  not null references muscles(id),
  is_primary  bool not null default true,
  primary key (exercise_id, muscle_id)
);

create table exercise_equipment (
  exercise_id  uuid not null references exercises(id) on delete cascade,
  equipment_id int  not null references equipment(id),
  primary key (exercise_id, equipment_id)
);

alter table workout_exercises
  add column exercise_id uuid references exercises(id) on delete set null;

-- Enable RLS (admin writes, app reads)
alter table exercise_categories enable row level security;
alter table muscles              enable row level security;
alter table equipment            enable row level security;
alter table exercises            enable row level security;
alter table exercise_muscles     enable row level security;
alter table exercise_equipment   enable row level security;

-- Public read for authenticated users
create policy "authenticated read exercise_categories" on exercise_categories for select to authenticated using (true);
create policy "authenticated read muscles"             on muscles             for select to authenticated using (true);
create policy "authenticated read equipment"           on equipment           for select to authenticated using (true);
create policy "authenticated read exercises"           on exercises           for select to authenticated using (is_active = true);
create policy "authenticated read exercise_muscles"    on exercise_muscles    for select to authenticated using (true);
create policy "authenticated read exercise_equipment"  on exercise_equipment  for select to authenticated using (true);

-- Indexes for common queries
create index idx_exercises_category_id on exercises(category_id);
create index idx_exercises_is_active on exercises(is_active);
create index idx_exercise_muscles_muscle_id on exercise_muscles(muscle_id);
create index idx_exercise_equipment_equipment_id on exercise_equipment(equipment_id);
