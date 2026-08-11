import { createClient } from '@supabase/supabase-js'
import { assertDeletionAllowed } from './admin-mfa-recovery-safety.mjs'

const [command, userId, factorId] = process.argv.slice(2)
const url = process.env.SUPABASE_RECOVERY_URL
const serviceRoleKey = process.env.SUPABASE_RECOVERY_SERVICE_ROLE_KEY

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

if (!url || !serviceRoleKey) fail('Set SUPABASE_RECOVERY_URL and SUPABASE_RECOVERY_SERVICE_ROLE_KEY in the operator shell.')
if (!['list', 'delete'].includes(command) || !userId) {
  fail('Usage: node scripts/admin-mfa-recovery.mjs list <user-id> | delete <user-id> <factor-id>')
}
if (command === 'delete' && !factorId) fail('A factor ID is required for deletion.')

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: authUserResult, error: authUserError } = await supabase.auth.admin.getUserById(userId)
if (authUserError) fail(`Canonical Auth user lookup failed: ${authUserError.message}`)
const canonicalAuthUser = authUserResult?.user
if (!canonicalAuthUser || canonicalAuthUser.id !== userId) fail('Canonical Auth user lookup did not return the exact target user.')

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('id, is_admin, is_blocked')
  .eq('id', userId)
  .single()

if (profileError) fail(`Profile lookup failed: ${profileError.message}`)
if (!profile?.is_admin) fail('Refusing recovery: the target profile is not an admin.')

const { data: factorsResult, error: listError } = await supabase.auth.admin.mfa.listFactors({ userId })
if (listError) fail(`Factor lookup failed: ${listError.message}`)

if (command === 'list') {
  process.stdout.write(`${JSON.stringify({
    authUser: { id: canonicalAuthUser.id, email: canonicalAuthUser.email },
    profile: { isAdmin: profile.is_admin, isBlocked: profile.is_blocked },
    factors: factorsResult.factors.map(({ id, factor_type, status, friendly_name, created_at }) => ({
      id,
      type: factor_type,
      status,
      name: friendly_name,
      createdAt: created_at,
    })),
  }, null, 2)}\n`)
  process.exit(0)
}

try {
  assertDeletionAllowed({
    authUser: canonicalAuthUser,
    profile,
    factors: factorsResult.factors,
    userId,
    factorId,
    confirmedUserId: process.env.MFA_RECOVERY_CONFIRMED_USER_ID,
  })
} catch (error) {
  fail(error instanceof Error ? error.message : 'Recovery safety check failed.')
}

const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({ userId, id: factorId })
if (deleteError) fail(`Factor deletion failed: ${deleteError.message}`)

process.stdout.write(`Deleted factor ${factorId} for admin ${userId}. A verified-factor deletion signs out active sessions.\n`)
