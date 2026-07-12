-- meal-photos bucket for user-logged meal images
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', true)
on conflict (id) do nothing;

-- Public read of meal photos
create policy "Public read meal photos"
on storage.objects for select
to public
using (bucket_id = 'meal-photos');

-- Authenticated users may upload into their own {userId}/... folder
create policy "Users upload own meal photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'meal-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);