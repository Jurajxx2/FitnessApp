# Retryable user deletion rollout

This stage is intentionally committed but not applied or deployed by the PR.

## Required order

1. Merge and deploy the MFA enrollment stage.
2. Complete verified TOTP enrollment for every administrator.
3. Apply and deploy the MFA enforcement/audit stage.
4. Apply `20260811234825_add_retryable_user_deletion_jobs.sql`.
5. Deploy `admin-manage-user` from this stage.
6. Deploy the admin web cutover.

Do not exercise this flow against a real account as a deployment probe. Use a
purpose-created disposable user only after an operator separately approves the
destructive test.

## Expected behavior

- The first delete request atomically blocks the athlete and creates or reuses
  one durable job.
- Restrictive Storage policies deny a blocked/deleted target's still-valid JWT
  from recreating objects in the three managed buckets. Managed inserts and
  updates take a shared target advisory lock; deletion takes the matching
  exclusive lock before its first lookup/block so in-flight writes finish
  before cleanup starts.
- Every invocation holds a short lease, lists persisted prefixes from offset
  zero, and removes no more than 100 objects per Storage API call.
- `chat-images`, `check-in-photos`, and `meal-photos` must all be empty under
  `<target-user-id>/` before the Auth user is removed.
- The ownership/reference preflight runs both when the job starts and again
  immediately before and after Auth deletion, after the target has been
  blocked. Every resumed Auth-stage attempt repeats the preflight.
- A missing Auth user is treated as an idempotent completed job.
- Legacy direct-user workout and meal-plan rows cascade with the profile rather
  than becoming accidental global content; nullable coach/audit ownership is
  retained with `ON DELETE SET NULL`.
- Retryable failures remain visible in both the user detail and Users page.
- Each intentional progress action gets a new request id. A network-ambiguous
  retry reuses its prior id and replays durable job state without advancing a
  second batch; any definitive HTTP response other than a timeout clears it for
  the next operator action.
- Objects owned by the target outside the supported prefix, or a retained
  cross-user meal-plan generation request, put the job in `manual_review`.
  Directly owned workouts or meal plans that remain assigned to another user do
  the same (`shared_direct_content`), so the operator can clear direct ownership
  before cascade. A workout counts as directly owned through **either**
  `workouts.user_id` **or** `workouts.owner_user_id`: both columns cascade from
  the owner, and the workout cascades on into `user_workouts` and
  `workout_exercises`, so ownership through either one would otherwise destroy
  another athlete's assignment silently. `meal_plans` has no owner column, so
  its branch stays keyed on `meal_plans.user_id`.
- A workout also counts as shared when its two ownership columns name
  **different** users — `user_id = target` with a non-null different
  `owner_user_id`, or the mirror image — even with no `user_workouts` row at
  all. This migration changes `workouts_user_id_fkey` from `ON DELETE SET NULL`
  to `ON DELETE CASCADE`, so that shape becomes newly destructive: deleting the
  target would take the workout and its `workout_exercises` away from the other
  owner. It is reachable because the RLS `WITH CHECK` for user-authored workouts
  constrains only `owner_user_id = auth.uid()` and leaves `user_id` free.
- Coach feedback the target authored on another athlete's training log
  (`workout_feedback.coach_id = target AND workout_feedback.user_id <> target`)
  also puts the job in `manual_review`, with code `shared_authored_content`.
  That row cascades away through `auth.users -> profiles -> workout_feedback`,
  which would destroy another user's content without an operator decision.
  **This condition is reachable only for a demoted ex-admin.** Inserting
  feedback requires `get_is_admin() AND coach_id = auth.uid()`, and
  `admin_begin_user_deletion` refuses to open a job for any `is_admin` profile,
  so the only way to reach it is to demote an administrator who already authored
  feedback and then delete that account. It is not a routine coach/athlete
  condition.
- Parent-row plus target advisory locks prevent assignment, direct-owner, or
  authored-feedback inserts/updates from creating any of these conditions after
  deletion begins. Every advisory lock in the migration lives in the single
  `hashtextextended(<uuid>::TEXT, 24001)` keyspace. Exactly one lock in that
  keyspace is exclusive — the first statement of `admin_begin_user_deletion`,
  taken before that function acquires any row lock. All fence locks are shared
  (so they never conflict with each other) and are still taken in ascending
  UUID-text order at each multi-lock site, so a future exclusive locker cannot
  invert against them. **Every fence locks exactly the keys its rejection
  predicate tests, and nothing else:** the owner fence locks and tests only the
  NEW `user_id`/`owner_user_id` values, the authored-feedback fence locks and
  tests only `NEW.coach_id`, and the assignment fence locks exactly the
  direct-owner set it then tests. OLD-side keys are never locked — a transfer
  that moves ownership or authorship *away* from a target only makes that target
  more deletable, and under MVCC the preflight sees either the pre-transfer row
  (flags manual review, conservative) or the post-transfer row (no longer
  references the target); anything moving *toward* a user is a NEW value and is
  still locked and tested.
- **This does not eliminate the deadlock class.** The assignment fence must lock
  deletion-target keys, because those are exactly the keys it tests. A
  transaction that takes a `profiles(T)` row lock and then performs a fenced
  assignment write against content owned by `T` **in the same transaction** can
  still cycle with `admin_begin_user_deletion` and abort with `40P01`. Keep
  profile writes and fenced content writes in separate transactions. A `40P01`
  is retryable: repeat the operation.
- After resolving that condition, the operator uses **Recheck deletion**. The
  service-role-only recheck RPC resumes only when every condition is clear;
  the Edge handler records the operator attempt and result in the security
  audit using the request id.

## Resolving a shared_direct_content job

The owner fence rejects any INSERT or UPDATE that leaves **either**
`workouts.user_id` or `workouts.owner_user_id` pointing at a user with an active
deletion job. An operator resolving `shared_direct_content` by transferring
ownership must therefore clear both columns in a **single** statement:

```sql
-- Rejected with 23514 while user_id still references the target.
update public.workouts set owner_user_id = null where id = '<workout-id>';

-- Accepted: neither column names the target after the statement.
update public.workouts
set user_id = null, owner_user_id = '<new-owner-id>'::uuid
where id = '<workout-id>';
```

Removing the offending `user_workouts` row, or deleting the workout outright,
is not fenced; only INSERT/UPDATE of the ownership columns is.

**Run profile writes and fenced content writes in separate transactions.** The
assignment fence has to lock the deletion target's key, so a single transaction
that updates `public.profiles` for a user and then writes fenced content owned
by that user can deadlock (`40P01`) against a concurrent
`admin_begin_user_deletion` for the same user. Commit the profile change first,
then do the content change. If you do hit `40P01`, nothing was applied — retry
the statement.

## Read-only verification

```sql
select status, count(*)
from public.user_deletion_jobs
group by status
order by status;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'user_deletion_jobs',
    'user_deletion_bucket_progress',
    'user_deletion_prefix_work'
  )
order by table_name, grantee, privilege_type;

select policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename like 'user_deletion%'
order by tablename, policyname;

select
  namespace.nspname as routine_schema,
  procedure.proname as routine_name,
  procedure.prosecdef as security_definer,
  procedure.provolatile,
  procedure.proconfig,
  pg_get_functiondef(procedure.oid) like '%pg_advisory_xact_lock_shared%' as takes_shared_lock
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'private'
  and procedure.proname in (
    'lock_deletion_storage_write',
    'lock_deletion_content_assignment',
    'lock_deletion_direct_content_owner',
    'lock_deletion_feedback_author'
  )
order by routine_name;

-- The workouts owner fence must watch owner_user_id, not just user_id, and the
-- authored-feedback fence must exist.
select
  trigger_record.tgname,
  pg_get_triggerdef(trigger_record.oid) as definition
from pg_trigger trigger_record
where trigger_record.tgrelid in (
    'public.workouts'::regclass,
    'public.workout_feedback'::regclass
  )
  and not trigger_record.tgisinternal
  and trigger_record.tgname in (
    'lock_workout_owner_during_deletion',
    'lock_workout_feedback_during_deletion'
  )
order by trigger_record.tgname;

select
  has_function_privilege(
    'anon',
    'private.lock_deletion_storage_write(text,text)',
    'EXECUTE'
  ) as anon_can_lock,
  has_function_privilege(
    'authenticated',
    'private.lock_deletion_storage_write(text,text)',
    'EXECUTE'
  ) as authenticated_can_lock;

-- Must be empty before resolving a shared_direct_content or
-- shared_authored_content manual-review job.
select 'workout' as content_type, workout.id
from public.workouts workout
where (
    workout.user_id = '<target-user-id>'::uuid
    or workout.owner_user_id = '<target-user-id>'::uuid
  )
  and (
    exists (
      select 1 from public.user_workouts assignment
      where assignment.workout_id = workout.id
        and assignment.user_id <> '<target-user-id>'::uuid
    )
    -- Divergent ownership: the other column names a different user, so the
    -- ON DELETE CASCADE would destroy their workout even with no assignment.
    or (workout.user_id is not null
        and workout.user_id <> '<target-user-id>'::uuid)
    or (workout.owner_user_id is not null
        and workout.owner_user_id <> '<target-user-id>'::uuid)
  )
union all
select 'meal_plan', plan.id
from public.meal_plans plan
where plan.user_id = '<target-user-id>'::uuid
  and exists (
    select 1 from public.user_meal_plans assignment
    where assignment.meal_plan_id = plan.id
      and assignment.user_id <> '<target-user-id>'::uuid
  )
union all
select 'workout_feedback', feedback.id
from public.workout_feedback feedback
where feedback.coach_id = '<target-user-id>'::uuid
  and feedback.user_id <> '<target-user-id>'::uuid;
```

`authenticated` must have read-only access to the job and bucket-progress
tables through the AAL2 admin RLS predicate. Prefix work remains service-role
only. All deletion-orchestration RPCs remain executable only by `service_role`.
`authenticated` may execute only the private Storage write-lock helper; its
`SECURITY DEFINER` body has an empty search path and returns only a boolean.
The verifier must report `anon_can_lock = false`, `authenticated_can_lock =
true`, `security_definer = true`, `provolatile = v`, an empty search path in
`proconfig`, and `takes_shared_lock = true`.

## Transactional verifier

After applying the migration, run the behavioral verifier:

```sh
supabase db query --linked --file supabase/verification/user_deletion_jobs.sql
```

**It never touches a live user row.** It creates its own synthetic `auth.users`
and `public.profiles` fixtures inside the transaction — ids in the
`dde11111-0000-4000-8000-*` namespace with `deletion-verifier+<role>@invalid.test`
addresses — drives `admin_begin_user_deletion`,
`admin_recheck_user_deletion_manual_review`, `admin_claim_user_deletion`, and
`admin_preflight_user_deletion` as `service_role` against those, and rolls
everything back. No real athlete is blocked and no exclusive advisory lock is
ever held on a real user's key, so a stalled session cannot stop a live user's
uploads. No Auth user is ever deleted. Every returned row must report
`passed = true`; the script also raises if any check failed.

The connection role must be able to `INSERT INTO auth.users`; the `postgres`
role used by `supabase db query --linked` can. The script aborts before writing
anything if fixtures from a previous killed session are still present.

It proves that a workout owned only through `workouts.owner_user_id` and
assigned to another athlete routes to `manual_review` with
`shared_direct_content`; that a workout whose two ownership columns name
different users still blocks resume after every assignment is removed; that the
recheck resumes only once both are cleared; that authored coach feedback routes
to `manual_review` with `shared_authored_content` at the begin, recheck, and
leased preflight sites; that the shared rows survive; and that new cross-user
assignments, `owner_user_id` transfers, single-column ownership transfers, and
cross-user feedback are rejected with `SQLSTATE 23514` **and** the fence's own
error message while a deletion job is active.
