-- Replace the dormant first-pass reminder state with one durable, retry-safe
-- source of truth for the weekly check-in reminder.
--
-- Pause the historical publishable-JWT job before adding the new state. This
-- migration deliberately does not reschedule it; the deployment runbook does
-- that only after credentials exist and live authorization probes pass.
select cron.unschedule('weekly-checkin-reminder')
where exists (
  select 1 from cron.job where jobname = 'weekly-checkin-reminder'
);

-- 20260811171224 added an earlier design that was never used while the cron was
-- paused. The linked tables are verified empty. Remove every old entry point
-- before replacing the state so future callers cannot target two protocols.
drop function if exists public.reserve_weekly_checkin_reminder_run(date);
drop function if exists public.complete_weekly_checkin_reminder_run(date, uuid, text, text);
drop function if exists public.claim_weekly_checkin_reminder_delivery(date, uuid);
drop function if exists public.record_weekly_checkin_reminder_delivery(date, uuid, text, text);
drop table if exists private.weekly_checkin_reminder_deliveries;
drop table if exists private.weekly_checkin_reminder_runs;

create table public.weekly_checkin_reminder_runs (
  id uuid primary key default gen_random_uuid(),
  reminder_week date not null unique
    check (extract(isodow from reminder_week) = 1),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'retryable', 'completed', 'no_recipients')),
  lease_owner uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  pending_count integer not null default 0 check (pending_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  retryable_count integer not null default 0 check (retryable_count >= 0),
  permanent_failed_count integer not null default 0 check (permanent_failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lease_owner is null) = (lease_expires_at is null))
);

create table public.weekly_checkin_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.weekly_checkin_reminder_runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_token_id uuid references public.device_tokens(id) on delete set null,
  platform text not null check (platform in ('android', 'ios')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'retryable', 'permanent_failed', 'skipped')),
  lease_owner uuid,
  lease_expires_at timestamptz,
  last_attempt_owner uuid,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  fcm_message_name text,
  last_error_code text,
  last_error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, user_id, platform),
  check ((lease_owner is null) = (lease_expires_at is null)),
  check (length(last_error_code) <= 120),
  check (length(last_error_message) <= 500)
);

create index weekly_checkin_reminder_deliveries_claim_idx
  on public.weekly_checkin_reminder_deliveries (run_id, status, lease_expires_at, created_at);

alter table public.weekly_checkin_reminder_runs enable row level security;
alter table public.weekly_checkin_reminder_deliveries enable row level security;

revoke all on table public.weekly_checkin_reminder_runs from public, anon, authenticated;
revoke all on table public.weekly_checkin_reminder_deliveries from public, anon, authenticated;
grant all on table public.weekly_checkin_reminder_runs to service_role;
grant all on table public.weekly_checkin_reminder_deliveries to service_role;

comment on table public.weekly_checkin_reminder_runs is
  'Service-role-only orchestration state for one logical weekly reminder run.';
comment on table public.weekly_checkin_reminder_deliveries is
  'Service-role-only per-user/platform delivery state; terminal rows and token-deletion history are preserved.';

create function public.claim_weekly_checkin_reminder_run(
  p_reminder_week date,
  p_lease_owner uuid,
  p_lease_seconds integer default 300
)
returns table (run_id uuid, claimed boolean, run_status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_run_id uuid;
  v_status text;
begin
  if p_reminder_week is null or p_lease_owner is null then
    raise exception 'reminder week and lease owner are required';
  end if;

  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'lease seconds must be between 30 and 900';
  end if;

  insert into public.weekly_checkin_reminder_runs (reminder_week)
  values (p_reminder_week)
  on conflict (reminder_week) do nothing;

  update public.weekly_checkin_reminder_runs as runs
  set status = 'running',
      lease_owner = p_lease_owner,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      attempt_count = runs.attempt_count + 1,
      started_at = coalesce(runs.started_at, v_now),
      completed_at = null,
      updated_at = v_now
  where runs.reminder_week = p_reminder_week
    and runs.status <> 'completed'
    and (
      runs.lease_expires_at is null
      or runs.lease_expires_at <= v_now
      or runs.lease_owner = p_lease_owner
    )
  returning runs.id, runs.status into v_run_id, v_status;

  if v_run_id is not null then
    return query select v_run_id, true, v_status;
    return;
  end if;

  return query
    select runs.id, false, runs.status
    from public.weekly_checkin_reminder_runs as runs
    where runs.reminder_week = p_reminder_week;
end;
$$;

create function public.seed_weekly_checkin_reminder_deliveries(
  p_run_id uuid,
  p_reminder_week date,
  p_lease_owner uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
begin
  if not exists (
    select 1
    from public.weekly_checkin_reminder_runs as runs
    where runs.id = p_run_id
      and runs.reminder_week = p_reminder_week
      and runs.status = 'running'
      and runs.lease_owner = p_lease_owner
      and runs.lease_expires_at > clock_timestamp()
  ) then
    raise exception 'reminder run lease is not owned by caller';
  end if;

  insert into public.weekly_checkin_reminder_deliveries (
    run_id,
    user_id,
    device_token_id,
    platform
  )
  select
    p_run_id,
    profiles.id,
    tokens.id,
    tokens.platform
  from public.profiles as profiles
  join public.device_tokens as tokens on tokens.user_id = profiles.id
  where profiles.is_admin = false
    and profiles.is_blocked = false
    and not exists (
      select 1
      from public.check_ins as check_ins
      where check_ins.user_id = profiles.id
        and check_ins.week_of = p_reminder_week
    )
  on conflict (run_id, user_id, platform) do update
  set device_token_id = excluded.device_token_id,
      status = case
        when weekly_checkin_reminder_deliveries.device_token_id is distinct from excluded.device_token_id
          then 'pending'
        else weekly_checkin_reminder_deliveries.status
      end,
      lease_owner = null,
      lease_expires_at = null,
      last_attempt_owner = case
        when weekly_checkin_reminder_deliveries.device_token_id is distinct from excluded.device_token_id
          then null
        else weekly_checkin_reminder_deliveries.last_attempt_owner
      end,
      last_error_code = case
        when weekly_checkin_reminder_deliveries.device_token_id is distinct from excluded.device_token_id
          then null
        else weekly_checkin_reminder_deliveries.last_error_code
      end,
      last_error_message = case
        when weekly_checkin_reminder_deliveries.device_token_id is distinct from excluded.device_token_id
          then null
        else weekly_checkin_reminder_deliveries.last_error_message
      end,
      updated_at = clock_timestamp()
  where weekly_checkin_reminder_deliveries.status in ('pending', 'retryable', 'permanent_failed');

  select count(*)::integer into v_total
  from public.weekly_checkin_reminder_deliveries as deliveries
  where deliveries.run_id = p_run_id;

  update public.weekly_checkin_reminder_runs as runs
  set recipient_count = v_total,
      updated_at = clock_timestamp()
  where runs.id = p_run_id
    and runs.lease_owner = p_lease_owner;

  return v_total;
end;
$$;

create function public.claim_weekly_checkin_reminder_deliveries(
  p_run_id uuid,
  p_lease_owner uuid,
  p_limit integer default 50,
  p_lease_seconds integer default 180
)
returns table (delivery_id uuid, user_id uuid, platform text, token text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'claim limit must be between 1 and 100';
  end if;

  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'lease seconds must be between 30 and 900';
  end if;

  if not exists (
    select 1
    from public.weekly_checkin_reminder_runs as runs
    where runs.id = p_run_id
      and runs.status = 'running'
      and runs.lease_owner = p_lease_owner
      and runs.lease_expires_at > v_now
  ) then
    raise exception 'reminder run lease is not owned by caller';
  end if;

  -- A user may submit a check-in after the delivery rows were seeded. Preserve
  -- the history but make the no-longer-eligible row terminal before claiming.
  update public.weekly_checkin_reminder_deliveries as deliveries
  set status = 'skipped',
      lease_owner = null,
      lease_expires_at = null,
      last_error_code = 'no_longer_eligible',
      last_error_message = 'Recipient no longer qualifies for this reminder week',
      updated_at = v_now
  from public.weekly_checkin_reminder_runs as runs,
       public.profiles as profiles
  where deliveries.run_id = p_run_id
    and runs.id = deliveries.run_id
    and profiles.id = deliveries.user_id
    and (
      deliveries.status in ('pending', 'retryable')
      or (deliveries.status = 'processing' and deliveries.lease_expires_at <= v_now)
    )
    and (
      profiles.is_admin
      or profiles.is_blocked
      or exists (
        select 1
        from public.check_ins as check_ins
        where check_ins.user_id = deliveries.user_id
          and check_ins.week_of = runs.reminder_week
      )
    );

  update public.weekly_checkin_reminder_deliveries as deliveries
  set status = 'permanent_failed',
      lease_owner = null,
      lease_expires_at = null,
      last_error_code = 'device_token_removed',
      last_error_message = 'Device token was removed before delivery',
      updated_at = v_now
  where deliveries.run_id = p_run_id
    and deliveries.device_token_id is null
    and (
      deliveries.status in ('pending', 'retryable')
      or (deliveries.status = 'processing' and deliveries.lease_expires_at <= v_now)
    );

  return query
  with candidates as (
    select deliveries.id
    from public.weekly_checkin_reminder_deliveries as deliveries
    join public.device_tokens as tokens on tokens.id = deliveries.device_token_id
    where deliveries.run_id = p_run_id
      and (
        deliveries.status = 'pending'
        or (
          deliveries.status = 'retryable'
          and deliveries.last_attempt_owner is distinct from p_lease_owner
        )
        or (
          deliveries.status = 'processing'
          and deliveries.lease_expires_at <= v_now
        )
      )
    order by deliveries.created_at, deliveries.id
    limit p_limit
    for update of deliveries skip locked
  ), claimed as (
    update public.weekly_checkin_reminder_deliveries as deliveries
    set status = 'processing',
        lease_owner = p_lease_owner,
        lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
        last_attempt_owner = p_lease_owner,
        attempt_count = deliveries.attempt_count + 1,
        updated_at = v_now
    from candidates
    where deliveries.id = candidates.id
    returning deliveries.id, deliveries.user_id, deliveries.platform, deliveries.device_token_id
  )
  select claimed.id, claimed.user_id, claimed.platform, tokens.token
  from claimed
  join public.device_tokens as tokens on tokens.id = claimed.device_token_id
  order by claimed.id;
end;
$$;

create function public.complete_weekly_checkin_reminder_deliveries(
  p_run_id uuid,
  p_lease_owner uuid,
  p_results jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_results is null
    or jsonb_typeof(p_results) <> 'array'
    or jsonb_array_length(p_results) < 1
    or jsonb_array_length(p_results) > 100 then
    raise exception 'results must contain between 1 and 100 items';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_results) as result(
      delivery_id uuid,
      status text,
      message_name text,
      error_code text,
      error_message text
    )
    where result.delivery_id is null
      or result.status not in ('sent', 'retryable', 'permanent_failed')
  ) then
    raise exception 'invalid delivery result';
  end if;

  with results as (
    select *
    from jsonb_to_recordset(p_results) as result(
      delivery_id uuid,
      status text,
      message_name text,
      error_code text,
      error_message text
    )
  )
  update public.weekly_checkin_reminder_deliveries as deliveries
  set status = results.status,
      lease_owner = null,
      lease_expires_at = null,
      fcm_message_name = case when results.status = 'sent' then left(results.message_name, 500) else null end,
      last_error_code = case when results.status <> 'sent' then left(results.error_code, 120) else null end,
      last_error_message = case when results.status <> 'sent' then left(results.error_message, 500) else null end,
      sent_at = case when results.status = 'sent' then clock_timestamp() else null end,
      updated_at = clock_timestamp()
  from results
  where deliveries.id = results.delivery_id
    and deliveries.run_id = p_run_id
    and deliveries.status = 'processing'
    and deliveries.lease_owner = p_lease_owner;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create function public.finalize_weekly_checkin_reminder_run(
  p_run_id uuid,
  p_lease_owner uuid
)
returns table (
  run_status text,
  recipient_count integer,
  pending_count integer,
  sent_count integer,
  retryable_count integer,
  permanent_failed_count integer,
  skipped_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
  v_pending integer;
  v_sent integer;
  v_retryable integer;
  v_permanent integer;
  v_skipped integer;
  v_status text;
begin
  if not exists (
    select 1
    from public.weekly_checkin_reminder_runs as runs
    where runs.id = p_run_id
      and runs.status = 'running'
      and runs.lease_owner = p_lease_owner
  ) then
    raise exception 'reminder run lease is not owned by caller';
  end if;

  select
    count(*)::integer,
    count(*) filter (where deliveries.status in ('pending', 'processing'))::integer,
    count(*) filter (where deliveries.status = 'sent')::integer,
    count(*) filter (where deliveries.status = 'retryable')::integer,
    count(*) filter (where deliveries.status = 'permanent_failed')::integer,
    count(*) filter (where deliveries.status = 'skipped')::integer
  into v_total, v_pending, v_sent, v_retryable, v_permanent, v_skipped
  from public.weekly_checkin_reminder_deliveries as deliveries
  where deliveries.run_id = p_run_id;

  v_status := case
    when v_total = 0 then 'no_recipients'
    when v_pending > 0 then 'pending'
    when v_retryable > 0 then 'retryable'
    else 'completed'
  end;

  update public.weekly_checkin_reminder_runs as runs
  set status = v_status,
      lease_owner = null,
      lease_expires_at = null,
      recipient_count = v_total,
      pending_count = v_pending,
      sent_count = v_sent,
      retryable_count = v_retryable,
      permanent_failed_count = v_permanent,
      skipped_count = v_skipped,
      completed_at = case when v_status = 'completed' then clock_timestamp() else null end,
      updated_at = clock_timestamp()
  where runs.id = p_run_id
    and runs.lease_owner = p_lease_owner;

  return query select v_status, v_total, v_pending, v_sent, v_retryable, v_permanent, v_skipped;
end;
$$;

revoke all on function public.claim_weekly_checkin_reminder_run(date, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.seed_weekly_checkin_reminder_deliveries(uuid, date, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_weekly_checkin_reminder_deliveries(uuid, uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_weekly_checkin_reminder_deliveries(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.finalize_weekly_checkin_reminder_run(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_weekly_checkin_reminder_run(date, uuid, integer)
  to service_role;
grant execute on function public.seed_weekly_checkin_reminder_deliveries(uuid, date, uuid)
  to service_role;
grant execute on function public.claim_weekly_checkin_reminder_deliveries(uuid, uuid, integer, integer)
  to service_role;
grant execute on function public.complete_weekly_checkin_reminder_deliveries(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.finalize_weekly_checkin_reminder_run(uuid, uuid)
  to service_role;
