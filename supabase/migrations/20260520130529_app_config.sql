create table if not exists app_config (
    key   text primary key,
    value text not null default ''
);

insert into app_config (key, value) values
    ('privacy_policy_url',   ''),
    ('terms_of_service_url', ''),
    ('account_deletion_url', '')
on conflict (key) do nothing;

alter table app_config enable row level security;

create policy "Authenticated users can read app config"
on app_config for select
to authenticated
using (true);