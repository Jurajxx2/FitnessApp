import { describe, expect, it } from 'vitest'
import { assertDeletionAllowed } from './admin-mfa-recovery-safety.mjs'

const admin = { id: 'admin-1', is_admin: true }
const authUser = { id: 'admin-1', email: 'canonical@example.com' }
const factors = [{ id: 'factor-1' }]

describe('admin MFA recovery deletion safety', () => {
  it('allows only an exact confirmed admin, user, and attached factor match', () => {
    expect(() => assertDeletionAllowed({
      authUser,
      profile: admin,
      factors,
      userId: 'admin-1',
      factorId: 'factor-1',
      confirmedUserId: 'admin-1',
    })).not.toThrow()
  })

  it('rejects a non-admin target', () => {
    expect(() => assertDeletionAllowed({
      authUser: { id: 'athlete-1', email: 'athlete@example.com' },
      profile: { id: 'athlete-1', is_admin: false },
      factors,
      userId: 'athlete-1',
      factorId: 'factor-1',
      confirmedUserId: 'athlete-1',
    })).toThrow('target profile is not an admin')
  })

  it('rejects a confirmation for a different user', () => {
    expect(() => assertDeletionAllowed({
      authUser,
      profile: admin,
      factors,
      userId: 'admin-1',
      factorId: 'factor-1',
      confirmedUserId: 'admin-2',
    })).toThrow('must exactly match')
  })

  it('rejects a factor not attached to the target user', () => {
    expect(() => assertDeletionAllowed({
      authUser,
      profile: admin,
      factors,
      userId: 'admin-1',
      factorId: 'factor-2',
      confirmedUserId: 'admin-1',
    })).toThrow('factor ID is not attached')
  })

  it('rejects a missing canonical Auth user', () => {
    expect(() => assertDeletionAllowed({
      authUser: null,
      profile: admin,
      factors,
      userId: 'admin-1',
      factorId: 'factor-1',
      confirmedUserId: 'admin-1',
    })).toThrow('canonical Auth user was not found')
  })

  it('rejects a canonical Auth user that does not match the target ID', () => {
    expect(() => assertDeletionAllowed({
      authUser: { id: 'admin-2', email: 'other@example.com' },
      profile: admin,
      factors,
      userId: 'admin-1',
      factorId: 'factor-1',
      confirmedUserId: 'admin-1',
    })).toThrow('canonical Auth user ID does not match')
  })
})
