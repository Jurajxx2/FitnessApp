# Weekly Check-in — Deploy Checklist (run by human)

All code is committed and locally verified. To ship, run against the linked Supabase project:

## 1. Apply migrations
The migration enables `pg_cron` and `pg_net` via `CREATE EXTENSION IF NOT EXISTS`. If your project restricts extension creation from migrations, enable both first from the Dashboard (Database → Extensions) before pushing — the `CREATE EXTENSION IF NOT EXISTS` statements are idempotent either way.
```bash
supabase db push
```
Applies: `check_ins`, `check-in-photos` bucket, cron schedule.

## 2. Set DB settings used by the cron job (once)
In the SQL editor (primary) or via `psql` connected to the project, run with real values:
```sql
ALTER DATABASE postgres SET app.settings.project_url      = 'https://<PROJECT_REF>.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
```
Then reload: `SELECT pg_reload_conf();` (new sessions pick it up; cron runs in fresh sessions).

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
  -H 'Authorization: Bearer <SERVICE_ROLE_KEY>'
# Expect one of: ok | nobody_to_remind | fcm_not_configured
```

## Note
Delivery depends on remaining-work #8 (wire the on-device push token — `getToken()` currently returns null). Until then the function correctly selects users and returns `fcm_not_configured`/`ok` without a device to deliver to.

## WARNING — FCM auth will 401 until OAuth is wired up
The `weekly-checkin-reminder` function currently sends `Authorization: Bearer $FCM_SERVER_KEY` against the FCM **HTTP v1** API. HTTP v1 only accepts OAuth2 access tokens minted from a service account — legacy static server keys are retired and will be rejected with 401. This needs a token-minting step shared with the existing `notify-chat-message` function before push delivery will actually work. This is a hard dependency of push-token wiring (remaining-work #8); do not attempt to implement the OAuth flow as part of this fix.
