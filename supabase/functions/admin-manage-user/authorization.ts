export interface AdminAuthorizationInput {
  assuranceLevel: string | null
  isAdmin: boolean | null | undefined
  isBlocked: boolean | null | undefined
}

export function accessTokenFromAuthorization(value: string | null): string | null {
  if (!value) return null
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim())
  return match?.[1] ?? null
}

/** Decode only after auth.getUser(token) has validated this exact token. */
export function assuranceLevelFromValidatedJwt(token: string): 'aal1' | 'aal2' | null {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return null
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(Math.ceil(payloadPart.length / 4) * 4, '=')
    const payload = JSON.parse(atob(base64)) as Record<string, unknown>
    return payload.aal === 'aal1' || payload.aal === 'aal2' ? payload.aal : null
  } catch {
    return null
  }
}

/** Authorization must be evaluated only after Auth has validated the access token. */
export function hasAdminMfaAccess(input: AdminAuthorizationInput): boolean {
  return input.assuranceLevel === 'aal2' && input.isAdmin === true && input.isBlocked === false
}
