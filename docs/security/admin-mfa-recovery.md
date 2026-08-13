# Admin MFA factor-loss recovery

Use this when an admin has lost a usable authenticator or an abandoned incomplete enrollment must be removed. The browser flow cannot delete any factor or bypass MFA, and Supabase does not issue recovery codes. This procedure uses the Auth Admin API from an authorized operator shell; it does not require access to the Supabase dashboard.

## Preconditions

1. Verify the admin's identity through an approved channel outside the locked account.
2. Obtain the exact Auth user UUID from the trusted account record. Do not identify the account from an unverified recovery message alone.
3. Use a short-lived operator shell with the project URL and service-role key. Never put the service-role key in the web app, a ticket, chat, shell history, or this repository.
4. If compromise is suspected, block the profile first and follow incident response instead of routine factor recovery.

## List factors

From `admin/`:

```sh
export SUPABASE_RECOVERY_URL='https://PROJECT_REF.supabase.co'
printf 'Service-role key: '
IFS= read -r -s SUPABASE_RECOVERY_SERVICE_ROLE_KEY
printf '\n'
export SUPABASE_RECOVERY_SERVICE_ROLE_KEY
node scripts/admin-mfa-recovery.mjs list 'AUTH_USER_UUID'
```

The silent prompt keeps the key out of shell history and terminal output. An approved secret-store injection that sets the environment variable without putting its value on the command line is also acceptable.

Confirm the canonical Supabase Auth email, exact Auth user UUID, admin flag, factor ID, status, and device name with the verified admin. The script deliberately does not use the mutable public profile email as identity evidence.

## Remove only the confirmed factor

The script requires a second exact-user confirmation and refuses factors that are not attached to that user:

```sh
export MFA_RECOVERY_CONFIRMED_USER_ID='AUTH_USER_UUID'
node scripts/admin-mfa-recovery.mjs delete 'AUTH_USER_UUID' 'FACTOR_UUID'
```

Deleting a verified factor through the Supabase Auth Admin API signs the user out of active sessions. Remove only the exact factor confirmed as lost or abandoned; incomplete factors use this same operator-only path because browser deletion has a verification race. If another verified factor remains, the admin can use it. If none remains, the next sign-in routes the admin to `/admin/mfa` to enroll a replacement before admin content is available.

## Close out

1. Have the admin sign in and enroll and verify a replacement authenticator.
2. Confirm the session reaches AAL2 and the admin workspace opens.
3. Record who approved and performed the recovery, the user UUID, factor ID, reason, and timestamp. Do not record setup keys or one-time codes.
4. Unset the operator variables and close the shell:

```sh
unset SUPABASE_RECOVERY_URL SUPABASE_RECOVERY_SERVICE_ROLE_KEY MFA_RECOVERY_CONFIRMED_USER_ID
```
