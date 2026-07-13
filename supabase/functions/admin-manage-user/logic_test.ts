import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { parseAdminUserRequest } from './logic.ts'

const userId = '550e8400-e29b-41d4-a716-446655440000'

Deno.test('accepts every supported account action', () => {
  for (const action of ['block', 'unblock', 'promote_admin', 'delete']) {
    assertEquals(parseAdminUserRequest({ action, userId }), { action, userId })
  }
})

Deno.test('rejects unsupported actions and malformed user ids', () => {
  assertEquals(parseAdminUserRequest({ action: 'demote_admin', userId }), null)
  assertEquals(parseAdminUserRequest({ action: 'delete', userId: 'not-a-uuid' }), null)
  assertEquals(parseAdminUserRequest(null), null)
})
