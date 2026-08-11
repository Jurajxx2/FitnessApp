# Athlete admin notes expansion verification

This runbook verifies the expansion migration only. It does not authorize the
later web cutover or removal of `profiles.admin_notes`.

## Before deployment

1. Confirm the linked migration list ends at `20260811172914` and the only
   pending file in this stage is
   `20260811173323_expand_athlete_admin_notes.sql`.
2. Re-audit the linked RPC identity and body. It must still be the ten-argument
   `public.admin_update_athlete_profile(...)` function returning `uuid`, running
   as `SECURITY INVOKER`, and using an empty `search_path`.
3. Confirm the migration creates
   `sync_athlete_admin_note_from_profile` before the backfill. This compatibility
   trigger must remain until the later cleanup drops `profiles.admin_notes`.

## After deployment

Run `athlete_admin_notes.sql` in the SQL editor or with `psql`. It performs
read-only catalog and backfill assertions and must return:

```text
athlete_admin_notes expansion contract verified
```

Then run this behavioral check with `psql`, substituting an existing admin UUID
and a different existing athlete UUID. The transaction is rolled back.

```sql
\set admin_id '00000000-0000-0000-0000-000000000000'
\set athlete_id '00000000-0000-0000-0000-000000000001'

BEGIN;
SET LOCAL ROLE authenticated;

-- An athlete cannot read or update coach notes directly.
SELECT set_config('request.jwt.claim.sub', :'athlete_id', true);
SELECT count(*) AS athlete_visible_note_rows
FROM public.athlete_admin_notes
WHERE profile_id = :'athlete_id'::UUID;
-- Expected: 0

UPDATE public.athlete_admin_notes
SET notes = 'athlete must not be able to write this'
WHERE profile_id = :'athlete_id'::UUID
RETURNING profile_id;
-- Expected: 0 rows

-- The legacy column cannot be used to bypass the separated table's RLS. The
-- inner block must catch SQLSTATE 42501 from the compatibility trigger.
DO $athlete_legacy_write_denial$
BEGIN
  BEGIN
    UPDATE public.profiles
    SET admin_notes = 'athlete must not be able to write this'
    WHERE id = (SELECT auth.uid());

    RAISE EXCEPTION 'athlete legacy coach-note update was not rejected';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END
$athlete_legacy_write_denial$;

-- An admin can dual-write through the unchanged RPC contract.
SELECT set_config('request.jwt.claim.sub', :'admin_id', true);
WITH athlete AS (
  SELECT *
  FROM public.profiles
  WHERE id = :'athlete_id'::UUID
)
SELECT public.admin_update_athlete_profile(
  athlete.id,
  athlete.full_name,
  athlete.age,
  athlete.height_cm,
  athlete.weight_kg,
  athlete.goal,
  athlete.activity_level,
  athlete.onboarding_complete,
  athlete.access_mode,
  'coach-notes-verification'
)
FROM athlete;
-- Expected: the athlete UUID

SELECT
  profile.admin_notes AS legacy_notes,
  admin_note.notes AS separated_notes,
  admin_note.updated_by
FROM public.profiles AS profile
JOIN public.athlete_admin_notes AS admin_note
  ON admin_note.profile_id = profile.id
WHERE profile.id = :'athlete_id'::UUID;
-- Expected: both note fields equal coach-notes-verification and updated_by
-- equals admin_id.

-- The compatibility trigger also protects writes through the old column while
-- old web clients remain deployed.
UPDATE public.profiles
SET admin_notes = 'legacy-trigger-verification'
WHERE id = :'athlete_id'::UUID;

SELECT
  profile.admin_notes AS legacy_notes,
  admin_note.notes AS separated_notes,
  admin_note.updated_by
FROM public.profiles AS profile
JOIN public.athlete_admin_notes AS admin_note
  ON admin_note.profile_id = profile.id
WHERE profile.id = :'athlete_id'::UUID;
-- Expected: both note fields equal legacy-trigger-verification and updated_by
-- equals admin_id.

ROLLBACK;
```

Do not drop `profiles.admin_notes` until the separately deployed web cutover has
removed wildcard profile reads, fetches coach notes separately, and has been
verified in the linked environment.
