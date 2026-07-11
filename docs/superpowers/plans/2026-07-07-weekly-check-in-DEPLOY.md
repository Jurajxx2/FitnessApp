# Weekly Check-in — Deploy Checklist (run by human)

All code is committed and locally verified. To ship, run against the linked Supabase project:

## 1. Apply migrations
The migration enables `pg_cron` and `pg_net` via `CREATE EXTENSION IF NOT EXISTS`. If your project restricts extension creation from migrations, enable both first from the Dashboard (Database → Extensions) before pushing — the `CREATE EXTENSION IF NOT EXISTS` statements are idempotent either way.
```bash
supabase db push
```
Applies: `check_ins`, `check-in-photos` bucket, cron schedule.

## 2. DB settings used by the cron job — SUPERSEDED, no action needed
~~The original plan was to `ALTER DATABASE postgres SET app.settings.*` and read it via
`current_setting()` in the cron job.~~ Hosted Supabase rejects that with
`42501 permission denied to set parameter` — the `postgres` role isn't superuser and
Support has to grant per-parameter exceptions. Migration
`20260710113343_fix_check_in_reminder_cron_auth.sql` fixes this by inlining the
**anon/publishable key** directly into the cron job's `Authorization` header instead of
`app.settings.service_role_key`. This works because the Edge Functions gateway only
needs *any* validly-signed project JWT to pass `verify_jwt` — the function does its own
privileged DB access via its auto-injected `SUPABASE_SERVICE_ROLE_KEY`, independent of
what's in the request header. The anon key is public by design (already shipped in the
mobile app bundle), so hardcoding it in a migration is safe. Verified working via
`supabase db query --linked` + a smoke-test curl (see step 6) on 2026-07-10.

## 3. Deploy the edge function
```bash
supabase functions deploy weekly-checkin-reminder
```

## 4. Ensure function secrets exist (shared with notify-chat-message)
`FCM_PROJECT_ID`, `FCM_SERVER_KEY` in the dashboard → Edge Functions → Secrets.
(`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

## 5. Verify cron registered
```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'weekly-checkin-reminder';
```

## 6. Manual smoke test
```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/weekly-checkin-reminder' \
  -H 'Authorization: Bearer <ANON_OR_SERVICE_ROLE_KEY>'
# Expect one of: ok | nobody_to_remind | fcm_not_configured
```
Any validly-signed project JWT works here (anon key is fine) — see step 2.

## Note
Delivery depends on remaining-work #8 (wire the on-device push token — `getToken()` currently returns null). Until then the function correctly selects users and returns `fcm_not_configured`/`ok` without a device to deliver to.

## WARNING — FCM auth will 401 until OAuth is wired up
The `weekly-checkin-reminder` function currently sends `Authorization: Bearer $FCM_SERVER_KEY` against the FCM **HTTP v1** API. HTTP v1 only accepts OAuth2 access tokens minted from a service account — legacy static server keys are retired and will be rejected with 401. This needs a token-minting step shared with the existing `notify-chat-message` function before push delivery will actually work. This is a hard dependency of push-token wiring (remaining-work #8); do not attempt to implement the OAuth flow as part of this fix.
