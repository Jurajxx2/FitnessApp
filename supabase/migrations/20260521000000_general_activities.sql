-- supabase/migrations/20260521000000_general_activities.sql

create table general_activity_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  activity_type     text not null check (activity_type in
                      ('WALKING','RUNNING','CYCLING','YOGA','SWIMMING','OTHER')),
  duration_minutes  int  not null check (duration_minutes between 1 and 1440),
  distance_km       numeric(6,2),
  rpe               smallint check (rpe between 1 and 10),
  logged_at         timestamptz not null default now(),
  notes             text,
  created_at        timestamptz not null default now()
);

alter table general_activity_logs enable row level security;

create policy "users manage own activity logs"
  on general_activity_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_general_activity_logs_user_date
  on general_activity_logs (user_id, logged_at desc);
