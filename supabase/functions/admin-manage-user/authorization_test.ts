import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { accessTokenFromAuthorization, assuranceLevelFromValidatedJwt, hasAdminMfaAccess } from './authorization.ts'

Deno.test('admin MFA authorization requires aal2, admin role, and an unblocked profile', () => {
  assertEquals(hasAdminMfaAccess({ assuranceLevel: 'aal2', isAdmin: true, isBlocked: false }), true)
  assertEquals(hasAdminMfaAccess({ assuranceLevel: 'aal1', isAdmin: true, isBlocked: false }), false)
  assertEquals(hasAdminMfaAccess({ assuranceLevel: 'aal2', isAdmin: false, isBlocked: false }), false)
  assertEquals(hasAdminMfaAccess({ assuranceLevel: 'aal2', isAdmin: true, isBlocked: true }), false)
  assertEquals(hasAdminMfaAccess({ assuranceLevel: null, isAdmin: true, isBlocked: false }), false)
})

Deno.test('validated JWT parser accepts only known assurance levels', () => {
  const token = (payload: object) => `header.${btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.signature`
  assertEquals(assuranceLevelFromValidatedJwt(token({ aal: 'aal2' })), 'aal2')
  assertEquals(assuranceLevelFromValidatedJwt(token({ aal: 'aal1' })), 'aal1')
  assertEquals(assuranceLevelFromValidatedJwt(token({ aal: 'aal3' })), null)
  assertEquals(assuranceLevelFromValidatedJwt('malformed'), null)
})

Deno.test('authorization parser accepts one bearer token and rejects malformed headers', () => {
  assertEquals(accessTokenFromAuthorization('Bearer signed.jwt.value'), 'signed.jwt.value')
  assertEquals(accessTokenFromAuthorization('bearer signed.jwt.value'), 'signed.jwt.value')
  assertEquals(accessTokenFromAuthorization('signed.jwt.value'), null)
  assertEquals(accessTokenFromAuthorization('Bearer one two'), null)
  assertEquals(accessTokenFromAuthorization(null), null)
})
