# Athlete admin notes cleanup deployment gate

This is the destructive contract phase. It removes `profiles.admin_notes` and
the temporary compatibility trigger. Do not apply it as part of the expansion
or web-cutover deployment.

## Hard gate before applying

All items below are mandatory. If any item is unknown or fails, stop; leave the
migration pending.

1. Confirm commit `552f5e5` (or a descendant containing the same web cutover) is
   deployed to the active admin portal.
2. In that deployed build, verify ordinary profile reads use explicit
   projections without `admin_notes`, and the athlete detail page reads coach
   notes from `athlete_admin_notes`.
3. As an admin in the linked environment, open an athlete with an existing
   non-empty coach note, edit it, save, refresh, and verify the updated value is
   loaded from `athlete_admin_notes`. Confirm profile editing is disabled when
   the separate coach-note request fails.
4. Verify no supported older admin build remains reachable. An old build will
   fail after the column is removed.
5. Run this precondition query in the linked SQL editor. It must return `0`:

   ```sql
   SELECT count(*) AS mismatched_populated_legacy_notes
   FROM public.profiles AS profile
   LEFT JOIN public.athlete_admin_notes AS admin_note
     ON admin_note.profile_id = profile.id
   WHERE profile.admin_notes IS NOT NULL
     AND admin_note.notes IS DISTINCT FROM profile.admin_notes;
   ```

The migration repeats item 5 while the trigger DDL holds a write-blocking lock
on `profiles` and raises SQLSTATE `23514` before replacing the RPC or dropping
the legacy function and column. A failure rolls the trigger drop back too.

## Apply only this migration

1. Confirm the linked migration list includes the expansion migration
   `20260811173323_expand_athlete_admin_notes.sql` and every migration before
   this cleanup stage.
2. Run a linked dry-run and inspect the output. The only pending file for this
   stage must be `20260811175009_cleanup_athlete_admin_notes.sql`.
3. Apply the migration through the normal migration runner. Do not paste only
   the `ALTER TABLE` statement into the SQL editor; the lock, precondition, RPC
   replacement, cleanup, and column drop are one contract.

Dropping the compatibility trigger takes an `ACCESS EXCLUSIVE` lock on
`profiles` for the rest of the atomic cleanup block. Apply during a quiet
window. If the lock cannot be acquired promptly, cancel and retry later rather
than bypassing the gate.

## Structural verification

Run `athlete_admin_notes_cleanup.sql` in the linked SQL editor or with `psql`.
It is read-only and must return:

```text
athlete admin notes cleanup contract verified
```

## Behavioral verification

Use `psql`, substituting an existing admin UUID and a different existing athlete
UUID. The transaction rolls back all test writes.

```sql
\set admin_id '00000000-0000-0000-0000-000000000000'
\set athlete_id '00000000-0000-0000-0000-000000000001'

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_id', true);

-- Preserve the athlete's current ordinary fields while exercising the exact
-- ten-argument PostgREST contract and the separated notes write.
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
  'cleanup-contract-verification'
)
FROM athlete;
-- Expected: the athlete UUID.

SELECT notes, updated_by
FROM public.athlete_admin_notes
WHERE profile_id = :'athlete_id'::UUID;
-- Expected: cleanup-contract-verification and admin_id.

-- An empty note still clears only the separated note row.
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
  '   '
)
FROM athlete;

SELECT count(*) AS remaining_note_rows
FROM public.athlete_admin_notes
WHERE profile_id = :'athlete_id'::UUID;
-- Expected: 0.

ROLLBACK;
```

Finally, repeat the admin-portal save and refresh check from the hard gate. If
the UI or RPC fails, do not attempt to recreate the legacy column ad hoc; stop
and diagnose the deployed build and migration state.
