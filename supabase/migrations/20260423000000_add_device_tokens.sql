create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  token text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

alter table device_tokens enable row level security;

create policy "Users can manage own device tokens"
  on device_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
