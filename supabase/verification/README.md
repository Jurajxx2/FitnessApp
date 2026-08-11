# Workout authentication PostgREST probes

Run these probes after deploying
`20260811171109_restrict_workout_reads_to_authenticated.sql`. They validate
the Data API boundary rather than relying only on the policy catalog.

## Setup

Export the project URL, the project's publishable or legacy anon key, and fresh
access tokens for an athlete and an administrator:

```bash
export SUPABASE_URL='https://PROJECT_REF.supabase.co'
export SUPABASE_PUBLIC_KEY='...'
export ATHLETE_ACCESS_TOKEN='...'
export ADMIN_ACCESS_TOKEN='...'
export ATHLETE_USER_ID='...'
export INACTIVE_GLOBAL_WORKOUT_ID='...'
export ASSIGNED_WORKOUT_ID='...'
```

Use a disposable test athlete with all of the following fixtures:

- one active global coach workout (`user_id IS NULL`, `source = 'coach'`);
- one inactive global coach workout that must remain hidden;
- one active coach workout assigned through `user_workouts` to the athlete;
- one legacy coach workout assigned through `user_id = ATHLETE_USER_ID`;
- one athlete-owned workout (`owner_user_id = ATHLETE_USER_ID`, `source = 'user'`);
- at least one `workout_exercises` row for each workout.

RLS-filtered `SELECT` requests normally return HTTP 200 with an empty JSON
array when no rows are visible. An empty array is therefore the expected
anonymous-denial result.

## Anonymous denial

Both requests must return HTTP 200 with body `[]`, even though the fixtures
above prove that workout data exists:

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

## Authenticated athlete access

Each request must return at least one row belonging to the corresponding
fixture. The exercise query must return exercises for all three accessible
workouts and none for an inactive global plan or another athlete's private
workout. Assignment and owner access are independent branches, so those plans
remain accessible even if they are not global library entries.

```bash
curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workouts" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --data-urlencode 'select=id,name,user_id,source,owner_user_id' \
  --data-urlencode 'user_id=is.null' \
  --data-urlencode 'source=eq.coach' \
  --data-urlencode 'is_active=eq.true'

# Must return []: authenticated users cannot bypass the active-library branch.
curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workouts" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --data-urlencode 'select=id' \
  --data-urlencode "id=eq.$INACTIVE_GLOBAL_WORKOUT_ID"

# Must return [] for exercises belonging to that inactive global workout too.
curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workout_exercises" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --data-urlencode 'select=id,workout_id' \
  --data-urlencode "workout_id=eq.$INACTIVE_GLOBAL_WORKOUT_ID"

curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workouts" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --data-urlencode 'select=id,name,user_id' \
  --data-urlencode "user_id=eq.$ATHLETE_USER_ID"

curl --fail-with-body --get "$SUPABASE_URL/rest/v1/user_workouts" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --data-urlencode 'select=workout_id,workouts(id,name,is_active)' \
  --data-urlencode "user_id=eq.$ATHLETE_USER_ID" \
  --data-urlencode "workout_id=eq.$ASSIGNED_WORKOUT_ID"

curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workouts" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --data-urlencode 'select=id,name,source,owner_user_id' \
  --data-urlencode "owner_user_id=eq.$ATHLETE_USER_ID" \
  --data-urlencode 'source=eq.user'

curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workout_exercises" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --data-urlencode 'select=id,workout_id'
```

## Administrator access

The administrator request must include global, assigned, and user-owned plans.
It confirms that the existing admin policy remains effective after the read
policy is recreated.

```bash
curl --fail-with-body --get "$SUPABASE_URL/rest/v1/workouts" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --data-urlencode 'select=id,name,user_id,source,owner_user_id' \
  --data-urlencode 'order=created_at.desc'
```

Finally, run the catalog verifier. Every returned row must have `passed=true`:

```bash
supabase db query --linked \
  --file supabase/verification/workout_authenticated_access.sql
```
