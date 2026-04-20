-- Migration: create exercises storage bucket
-- Purpose: store exercise images uploaded by the import script

insert into storage.buckets (id, name, public)
values ('exercises', 'exercises', true)
on conflict (id) do nothing;

-- Public read for all authenticated users
create policy "authenticated read exercises bucket"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'exercises');

-- Service role write (import script uses service key)
create policy "service role write exercises bucket"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'exercises');

create policy "service role update exercises bucket"
  on storage.objects for update
  to service_role
  using (bucket_id = 'exercises');

create policy "service role delete exercises bucket"
  on storage.objects for delete
  to service_role
  using (bucket_id = 'exercises');
