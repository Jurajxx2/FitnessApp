import type { Profile } from '../types/database'
import { athleteHomePath } from './access'

export type AuthenticatorAssuranceLevel = 'aal1' | 'aal2' | null

export interface AssuranceDestinationState {
  currentLevel: AuthenticatorAssuranceLevel
  error?: Error | null
}

export type PostAuthDestination = '/admin' | '/admin/mfa' | '/nutrition' | '/activity'

/**
 * Keep every transition into an authenticated workspace on the same policy:
 * athletes retain their normal landing page, while an active admin must finish
 * MFA before entering the admin surface. Blocked admins still go through the
 * admin guard so the blocked-account message wins over MFA enrollment.
 */
export function postAuthDestination(
  profile: Pick<Profile, 'is_admin' | 'is_blocked' | 'access_mode'> | null | undefined,
  assurance: AssuranceDestinationState,
): PostAuthDestination {
  if (!profile?.is_admin) return athleteHomePath(profile)
  if (profile.is_blocked) return '/admin'
  if (assurance.currentLevel === 'aal2' && !assurance.error) return '/admin'
  return '/admin/mfa'
}
