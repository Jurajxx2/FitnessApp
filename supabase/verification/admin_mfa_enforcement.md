# Administrator MFA enforcement deployment gate

The audit schema migration and final MFA enforcement are intentionally split.
`20260811212458_create_admin_security_audit.sql` is non-enforcing prerequisite
infrastructure. The final SQL lives outside the migrations directory at
`supabase/activation/enforce_admin_mfa.sql`, so a normal prerequisite database
push cannot enforce AAL2 before the function deployment and administrator
rehearsal gate. The linked environment currently has active administrators
without verified factors, so applying enforcement now would intentionally
remove their administrator access.

## Required deployment order

1. Deploy the MFA enrollment/challenge/recovery admin UI from the immediately
   preceding staged branch. Do not apply the enforcement migration yet.
2. Apply only `20260811212458_create_admin_security_audit.sql`, then verify the
   table and append-only privileges with the structural part of the SQL script.
3. Deploy `admin-create-user` and `admin-manage-user` from this branch. Both
   functions validate the exact bearer token with Supabase Auth, require an
   `aal2` claim, and call the central invoker-context admin predicate before a
   service-role client is created.
4. In a separate session for every administrator, enroll and verify TOTP,
   complete a fresh challenge, and confirm the resulting access token has
   `aal = aal2`.
5. Confirm at least two controlled recovery-capable administrator accounts can
   independently sign in and reach the admin portal at `aal2`.
6. Only then run `supabase migration new enforce_admin_mfa`, copy the reviewed
   `supabase/activation/enforce_admin_mfa.sql` template into that newly generated
   migration unchanged, and review its timestamp/order in a separate activation
   PR. Dry-run and apply that fresh migration only after the gate passes. Do not
   combine it with enabling leaked password protection; that Auth setting is a
   separate operational change.

### Hard ordering requirement: audit table before function deploy

Step 2 must complete before step 3. This is not a preference — it is a hard
prerequisite, and the two steps are the only pair in this list that cannot be
reordered or run concurrently.

`admin-create-user` and `admin-manage-user` write an `attempt` row to
`public.admin_security_audit` **before** performing any mutation, and fail
closed when that write does not succeed. The table is created only by
`20260811212458_create_admin_security_audit.sql`. Deploying either function
before that migration is applied therefore breaks **every** administrator
action — block, unblock, promote, delete, and invite alike. There is no partial
degradation and no unaffected action.

Failure symptom, so an operator recognises it immediately:

- Every admin mutation returns HTTP `500` with body
  `{"error":"Unable to record the account action"}`.
- The admin UI shows its generic failure copy for every action; retrying and
  reloading never helps, and the same request id fails identically.
- Function logs show `Unable to persist admin security audit` with a request id,
  action, and outcome, and no target or PII.
- No mutation is applied, so the failure is safe: it fails closed, and no
  account is left partially modified.

Recovery is simply to apply `20260811212458` and retry; no redeploy or rollback
of the functions is required, and no data repair is needed.

Applying the migration **before** deploying the functions is always safe for
currently-released clients. The migration only creates the audit table and its
append-only privileges; the live functions in production do not reference the
table, so an applied-but-not-yet-deployed window has no effect on them. Prefer
that window over any window in the opposite direction.

The central predicate keeps a service-role branch for non-user maintenance.
For human sessions it requires the current `profiles` row to be `is_admin`, not
blocked, and the validated JWT to be `aal2`. `private.current_user_has_feature`
continues to grant ordinary athletes their configured nutrition/activity
entitlements because its non-admin profile branch is unchanged.

## Pre-apply checks

Before applying, confirm the pending set and MFA readiness in the linked SQL
editor:

```sql
SELECT
  count(*) FILTER (WHERE profile.is_admin AND NOT profile.is_blocked) AS active_admins,
  count(*) FILTER (
    WHERE profile.is_admin
      AND NOT profile.is_blocked
      AND EXISTS (
        SELECT 1
        FROM auth.mfa_factors AS factor
        WHERE factor.user_id = profile.id
          AND factor.status = 'verified'
      )
  ) AS admins_with_verified_factor
FROM public.profiles AS profile;
```

The two counts must be equal and at least `2`. A verified factor alone is not a
successful rehearsal: complete the separate-session sign-in checks above too.

Run a linked dry run before each step and inspect it. This stacked branch comes
after the gated coach-note cleanup migration, so complete and verify that
earlier rollout before applying the audit schema. Once the preceding stack is
current, the audit-schema migration must be the only pending migration in this
stage. The activation template must not appear in `supabase migration list` at
all until step 6 creates the fresh gated migration; at that point the fresh
enforcement migration must be the only pending migration. Do not use
`--include-all` to paper over an unexpected migration order.

## Audit and retry contract

Every accepted account action uses a caller-supplied `x-request-id`. The Edge
Function durably appends an `attempt` audit row before any privileged mutation;
if that insert is unavailable, the mutation does not run. A unique
actor/action/request constraint prevents a duplicate attempt from repeating the
mutation. After the mutation, the function appends exactly one `success` or
`failure` row containing the exact sanitized HTTP status/body returned to the
caller. A duplicate request replays that terminal result verbatim; if only the
attempt exists, it returns HTTP 202 pending and keeps the same request ID.

A storage outage after the privileged operation can still prevent that final
result row. The durable `attempt` remains the reconciliation record, and clients
preserve their request ID across transport/5xx failures and HTTP 202 pending
responses. Account actions may clear the request only after a terminal replay
or after refreshed profile state verifies the requested result. Closing and
reopening a sent confirmation does not abandon its ID. Operators must reconcile
attempts without a terminal result before deliberately starting a new intent.

Direct user deletion is deliberately unavailable in this stage: it records an
`attempt` plus a sanitized `failure` result and returns HTTP 409. The following
retryable deletion-jobs stage will own deletion, storage cleanup, idempotency,
and its result audit.

## Post-apply verification

Run the transactional verifier:

```bash
supabase db query --linked \
  --file supabase/verification/admin_mfa_enforcement.sql
```

Every row must report `passed = true`. The SQL covers anonymous helper denial,
athlete entitlement preservation, athlete/admin separation, admin `aal1`
denial, admin `aal2` access, exercise-policy convergence, service-role-only
append privileges, ordered/idempotent audit inserts, atomic profile mutations,
immutable actor/target snapshots, and rolled-back audit fixtures. The schema
invariant `profiles_admin_not_blocked` prevents constructing a blocked
administrator row; the Edge Function unit suite separately exercises that
defensive denial path.

Then use fresh real sessions to verify:

- anonymous, ordinary athlete, administrator `aal1`, and blocked-account calls
  to both Edge Functions are rejected before privileged operations;
- an active administrator `aal2` call succeeds;
- each invite/block/unblock/promote action creates an `attempt` before mutation
  and a terminal result afterward;
- direct delete is rejected without deleting the Auth user and records the
  expected sanitized attempt/failure pair;
- audit `detail` contains only fixed reason codes and never tokens, email
  addresses, names, request bodies, or raw provider/database messages;
- `UPDATE`, `DELETE`, and `TRUNCATE` are unavailable on the audit table.

If any admin is locked out, stop. Do not weaken individual RLS policies. Restore
the prior central helper in a reviewed corrective migration, resolve factor
enrollment/recovery, and repeat this gate.
