import { describe, expect, it } from 'vitest'
import {
  friendlyAuthError,
  isCompromisedPasswordError,
  isCompromisedPasswordWarning,
} from './authErrors'

describe('auth error mapping', () => {
  it('uses the friendly message only for the pwned weak-password reason', () => {
    const compromised = { code: 'weak_password', name: 'AuthWeakPasswordError', reasons: ['pwned'], message: 'raw' }
    expect(isCompromisedPasswordError(compromised)).toBe(true)
    expect(friendlyAuthError(compromised, 'Choose a unique password.', 'Fallback')).toBe('Choose a unique password.')
    expect(isCompromisedPasswordWarning({ reasons: ['pwned'] })).toBe(true)
  })

  it('preserves other safe Auth messages and falls back for unknown values', () => {
    expect(friendlyAuthError({ code: 'invalid_credentials', message: 'Invalid login' }, 'Compromised', 'Fallback')).toBe('Invalid login')
    expect(friendlyAuthError(null, 'Compromised', 'Fallback')).toBe('Fallback')
    expect(isCompromisedPasswordError({ code: 'weak_password', reasons: ['length'] })).toBe(false)
  })
})
