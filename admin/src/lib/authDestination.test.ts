import { describe, expect, it } from 'vitest'
import { postAuthDestination } from './authDestination'

describe('postAuthDestination', () => {
  it('keeps athlete routing independent of AAL', () => {
    expect(postAuthDestination({ is_admin: false, is_blocked: false, access_mode: 'activity' }, { currentLevel: 'aal1' })).toBe('/activity')
    expect(postAuthDestination({ is_admin: false, is_blocked: false, access_mode: 'both' }, { currentLevel: 'aal2' })).toBe('/nutrition')
  })

  it('routes an active aal1 admin to MFA and an aal2 admin to admin', () => {
    const admin = { is_admin: true, is_blocked: false, access_mode: 'both' as const }
    expect(postAuthDestination(admin, { currentLevel: 'aal1' })).toBe('/admin/mfa')
    expect(postAuthDestination(admin, { currentLevel: 'aal2' })).toBe('/admin')
  })

  it('fails an admin assurance error closed to MFA', () => {
    const admin = { is_admin: true, is_blocked: false, access_mode: 'both' as const }
    expect(postAuthDestination(admin, { currentLevel: 'aal2', error: new Error('unavailable') })).toBe('/admin/mfa')
  })

  it('sends a blocked admin through the admin guard so the block message wins', () => {
    const blockedAdmin = { is_admin: true, is_blocked: true, access_mode: 'both' as const }
    expect(postAuthDestination(blockedAdmin, { currentLevel: 'aal1' })).toBe('/admin')
  })
})
