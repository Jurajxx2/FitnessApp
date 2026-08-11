import { describe, expect, it } from 'vitest'
import { qrCodeDataUrl, safeAdminReturnTo, verifiedTotpFactors } from './mfa'

describe('MFA helpers', () => {
  it('allows only internal admin return destinations', () => {
    expect(safeAdminReturnTo('/admin/users?filter=active')).toBe('/admin/users?filter=active')
    expect(safeAdminReturnTo('//evil.example/admin')).toBe('/admin')
    expect(safeAdminReturnTo('https://evil.example/admin')).toBe('/admin')
    expect(safeAdminReturnTo('/nutrition')).toBe('/admin')
  })

  it('selects only verified TOTP factors', () => {
    const factors = [
      { id: 'verified', factor_type: 'totp', status: 'verified' },
      { id: 'unfinished', factor_type: 'totp', status: 'unverified' },
      { id: 'phone', factor_type: 'phone', status: 'verified' },
    ] as any[]
    expect(verifiedTotpFactors(factors).map(factor => factor.id)).toEqual(['verified'])
  })

  it('turns raw Supabase SVG into an image data URL without changing an existing URL', () => {
    expect(qrCodeDataUrl('<svg></svg>')).toContain('data:image/svg+xml;utf-8,')
    expect(qrCodeDataUrl('data:image/svg+xml;base64,abc')).toBe('data:image/svg+xml;base64,abc')
  })
})
