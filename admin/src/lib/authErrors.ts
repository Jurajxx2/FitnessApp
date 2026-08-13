interface AuthErrorLike {
  code?: unknown
  name?: unknown
  message?: unknown
  reasons?: unknown
}

interface WeakPasswordLike {
  reasons?: unknown
}

function hasPwnedReason(value: WeakPasswordLike | null | undefined): boolean {
  return Array.isArray(value?.reasons) && value.reasons.includes('pwned')
}

export function isCompromisedPasswordError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const authError = error as AuthErrorLike
  const isWeakPassword = authError.code === 'weak_password' || authError.name === 'AuthWeakPasswordError'
  return isWeakPassword && hasPwnedReason(authError)
}

export function isCompromisedPasswordWarning(warning: WeakPasswordLike | null | undefined): boolean {
  return hasPwnedReason(warning)
}

export function friendlyAuthError(
  error: unknown,
  compromisedPasswordMessage: string,
  fallback: string,
): string {
  if (isCompromisedPasswordError(error)) return compromisedPasswordMessage
  if (typeof error === 'object' && error !== null && typeof (error as AuthErrorLike).message === 'string') {
    return (error as AuthErrorLike).message as string
  }
  return fallback
}
