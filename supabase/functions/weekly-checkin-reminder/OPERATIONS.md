# Weekly check-in reminder security operations

The schema migration and Edge Function are safe to review independently, but the
function must not be scheduled until the credentials below exist and the probes
pass. Credential creation, function deployment, live probes, and rescheduling
are not performed by the migration. The forward migration does idempotently
pause the old job and replaces the verified-empty first-pass reminder tables and
RPCs with the state model used by this function.

## Required configuration

1. Create a Supabase **secret API key** named `automations`. Do not use the
   service-role key, a user JWT, or a publishable key. Supabase exposes named
   keys to Edge Functions through `SUPABASE_SECRET_KEYS`; `@supabase/server`
   validates only `secret:automations` for this endpoint.
2. Add `FIREBASE_SERVICE_ACCOUNT_JSON` as an Edge Function secret. It must be the
   complete JSON for a Google service account belonging to the Firebase project.
   Grant that account only the Firebase Cloud Messaging API role required to
   send messages. The function mints short-lived OAuth tokens with the
   `firebase.messaging` scope; `FCM_SERVER_KEY` is no longer used.
3. Store the project URL and the same `automations` key value in Supabase Vault.
   Suggested Vault names are `project_url` and
   `weekly_checkin_reminder_automations_key`.

The named key exists in two deliberately separate runtime stores: the Edge
Function environment receives the API-key registry automatically, while
`pg_net` reads the outbound request credential from Vault.

## Controlled rollout

Before deploying, capture the current job definition. The forward security
migration pauses the insecure job before creating reminder state; the explicit
query below is an additional rollout gate and is safe to repeat:

```sql
select jobid, jobname, schedule, command
from cron.job
where jobname = 'weekly-checkin-reminder';

select cron.unschedule('weekly-checkin-reminder')
where exists (
  select 1 from cron.job where jobname = 'weekly-checkin-reminder'
);
```

Then apply the schema migration, deploy `weekly-checkin-reminder` with its
committed `verify_jwt = false` configuration, and verify the following against
the deployed endpoint:

- `GET`, including a valid key, returns `405` and `Allow: POST`.
- Anonymous `POST` returns `401`.
- `POST` with a user JWT or publishable key returns `401`.
- `POST` with the wrong secret key returns `401`.
- A staging-only `POST` with `apikey: <automations key>` and `{}` reaches the
  current week. `{ "week_of": "YYYY-MM-DD" }` may retry a prior Monday only.
- Two concurrent valid staging calls acquire one logical weekly run.
- After one successful and one failed staged delivery, a retry claims only the
  failed delivery.

Only after those checks pass, create the job with Vault-backed credentials:

```sql
select cron.schedule(
  'weekly-checkin-reminder',
  '0 17 * * 0',
  $cron$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
    ) || '/functions/v1/weekly-checkin-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'weekly_checkin_reminder_automations_key'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
```

Confirm the job exists and inspect `net._http_response` after the first staged
run. Never put the key value or a service-role credential in migration source.

## Operational limitations

- Android and iOS token providers are still stubs, so this change does not make
  real push delivery available. With no device tokens the run is recorded as
  `no_recipients` and can be invoked again later in the same week.
- One invocation processes at most 500 device deliveries in batches of 50. A
  `pending` or `retryable`/HTTP `202` response requires another authenticated
  invocation.
- Successful rows are not reclaimed. Transient failures remain retryable;
  malformed and unregistered tokens become terminal failures. There is an
  unavoidable crash window between FCM accepting a message and the database
  recording success; FCM HTTP v1 has no caller-provided idempotency key, so a
  process crash in that window can cause a duplicate notification.
- Delivery errors are retained only in the service-role-only table and are
  truncated. Device tokens are read at claim time and are not copied into run
  history.

The old migration contains a legacy anonymous JWT. Applied migrations are
immutable in this repository, so this slice does not rewrite that historical
file. The credential was publishable (not privileged), the forward migration
unschedules every job using it, and the replacement command reads only from
Vault. Once clients have migrated to the new publishable-key model, revoke the
legacy anonymous JWT in the Supabase API-key settings; rewriting Git history is
neither required nor sufficient revocation.
