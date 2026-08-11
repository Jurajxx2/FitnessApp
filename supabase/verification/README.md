# Workout authentication verification

Run these checks after deploying
`20260811173250_restrict_workout_reads_to_authenticated.sql`. They cover both
the Postgres policy catalog and the Data API boundary.

## Transactional SQL verifier

The verifier creates five temporary workout shapes for one ordinary,
unblocked athlete with activity access, impersonates the `authenticated` and
`anon` roles, and rolls the fixtures back. It verifies these independent read
paths for both `workouts` and `workout_exercises`:

- active global coach library (`user_id IS NULL`, `source = 'coach'`,
  `is_active IS TRUE`);
- modern assignment through `public.user_workouts`;
- legacy direct assignment through `workouts.user_id`;
- athlete ownership through `workouts.owner_user_id`;
- denial of an inactive, unassigned coach workout;
- denial of all workout data to the `anon` role.

The linked project must contain at least one non-admin, unblocked profile whose
`access_mode` is `activity` or `both`. The script fails before creating a
fixture if that precondition is not met. All fixture writes are inside one
transaction and end with `ROLLBACK`.

```bash
supabase db query --linked \
  --file supabase/verification/workout_authenticated_access.sql
```

Every returned row must have `passed = true`.

## PostgREST probes

Export the project URL, a publishable or legacy anon key, fresh athlete/admin
access tokens, and IDs for existing QA fixtures:

```bash
export SUPABASE_URL='https://PROJECT_REF.supabase.co'
export SUPABASE_PUBLIC_KEY='...'
export ATHLETE_ACCESS_TOKEN='...'
export ADMIN_ACCESS_TOKEN='...'
export ATHLETE_USER_ID='...'
export ACTIVE_GLOBAL_WORKOUT_ID='...'
export MODERN_ASSIGNED_WORKOUT_ID='...'
export LEGACY_ASSIGNED_WORKOUT_ID='...'
export OWNED_WORKOUT_ID='...'
export INACCESSIBLE_WORKOUT_ID='...'
```

`MODERN_ASSIGNED_WORKOUT_ID` must have a `user_workouts` row for the athlete
while its `workouts.user_id` and `workouts.owner_user_id` are both different
from the athlete. To isolate the modern branch from the global-library branch,
use an inactive coach workout. Each workout should have at least one
`workout_exercises` row.

RLS-filtered reads normally return HTTP 200 with `[]` when no rows are visible.

### Anonymous denial

Both bodies must be `[]`, even though the fixtures prove rows exist:

```bash
curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workouts" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  --data-urlencode 'select=id' \
  --data-urlencode 'limit=1'

curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workout_exercises" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  --data-urlencode 'select=id,workout_id' \
  --data-urlencode 'limit=1'
```

### Authenticated athlete branches

Each accessible workout and its exercise query must return a row. The final
inaccessible queries must return `[]`.

```bash
for workout_id in \
  "$ACTIVE_GLOBAL_WORKOUT_ID" \
  "$MODERN_ASSIGNED_WORKOUT_ID" \
  "$LEGACY_ASSIGNED_WORKOUT_ID" \
  "$OWNED_WORKOUT_ID"
do
  curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workouts" \
    -H "apikey: $SUPABASE_PUBLIC_KEY" \
    -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
    --data-urlencode 'select=id,name,user_id,source,owner_user_id,is_active' \
    --data-urlencode "id=eq.$workout_id"

  curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workout_exercises" \
    -H "apikey: $SUPABASE_PUBLIC_KEY" \
    -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
    --data-urlencode 'select=id,workout_id' \
    --data-urlencode "workout_id=eq.$workout_id"
done

curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workouts" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --data-urlencode 'select=id' \
  --data-urlencode "id=eq.$INACCESSIBLE_WORKOUT_ID"

curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workout_exercises" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --data-urlencode 'select=id,workout_id' \
  --data-urlencode "workout_id=eq.$INACCESSIBLE_WORKOUT_ID"
```

Confirm the modern assignment fixture itself is visible in the junction table:

```bash
curl --fail-with-body --get "$SUPABASE_URL/rest/v1/user_workouts" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --data-urlencode 'select=user_id,workout_id' \
  --data-urlencode "user_id=eq.$ATHLETE_USER_ID" \
  --data-urlencode "workout_id=eq.$MODERN_ASSIGNED_WORKOUT_ID"
```

### Administrator access

The existing admin policy is intentionally unchanged. This request must still
return global, assigned, and athlete-owned QA fixtures:

```bash
curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workouts" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --data-urlencode 'select=id,name,user_id,source,owner_user_id,is_active' \
  --data-urlencode 'order=created_at.desc'
```
