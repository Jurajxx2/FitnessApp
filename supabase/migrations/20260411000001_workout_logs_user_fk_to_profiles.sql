-- Fix: workout_logs.user_id FK was pointing to auth.users instead of public.profiles
-- PostgREST cannot resolve profiles() join without a FK to public.profiles

alter table workout_logs
  drop constraint workout_logs_user_id_fkey,
  add constraint workout_logs_user_id_fkey
    foreign key (user_id) references profiles(id) on delete cascade;
