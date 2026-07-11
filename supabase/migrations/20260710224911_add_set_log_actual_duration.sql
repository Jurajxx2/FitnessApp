-- Timed exercises previously overloaded actual_rest_seconds for their duration. That meant
-- completing a rest countdown could overwrite the duration used in exercise history and charts.
alter table public.set_logs
  add column if not exists actual_duration_seconds int
    check (actual_duration_seconds >= 0);
