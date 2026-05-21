-- supabase/migrations/20260521000001_workout_set_logs.sql

create table set_logs (
  id                    uuid primary key default gen_random_uuid(),
  exercise_log_id       uuid not null references exercise_logs(id) on delete cascade,
  sort_order            int not null,
  target_reps           int,
  actual_reps           int,
  target_weight_kg      numeric(6,2),
  actual_weight_kg      numeric(6,2),
  rpe                   smallint check (rpe between 1 and 10),
  target_rest_seconds   int,
  actual_rest_seconds   int,
  completed             boolean not null default false,
  created_at            timestamptz not null default now()
);

alter table set_logs enable row level security;

create policy "users manage own set logs"
  on set_logs for all
  using (exists (
    select 1 from exercise_logs el
      join workout_logs wl on wl.id = el.workout_log_id
      where el.id = exercise_log_id and wl.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from exercise_logs el
      join workout_logs wl on wl.id = el.workout_log_id
      where el.id = exercise_log_id and wl.user_id = auth.uid()
  ));

create index idx_set_logs_exercise on set_logs (exercise_log_id, sort_order);

-- Backfill legacy exercise_logs rows into set_logs so old data renders through new UI.
do $$
declare r record;
declare parsed_reps int;
begin
  for r in
    select id, sets_completed, reps_completed, weight_kg
      from exercise_logs
      where sets_completed > 0
  loop
    begin
      parsed_reps := nullif(
        regexp_replace(split_part(coalesce(r.reps_completed,''),'-',1),'[^0-9]','','g'),
        ''
      )::int;
    exception when others then
      parsed_reps := null;
    end;

    insert into set_logs (exercise_log_id, sort_order, actual_reps, actual_weight_kg, completed)
    select r.id, gs, parsed_reps, r.weight_kg, true
      from generate_series(1, r.sets_completed) gs;
  end loop;
end$$;
