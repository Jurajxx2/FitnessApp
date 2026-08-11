import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BlockedAccount } from './BlockedAccount'
import { athleteHomePath } from '../lib/access'

export function AdminRouteGuard() {
  const { session, profile, isAdmin, assuranceLevel, nextAssuranceLevel, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (profile?.is_blocked) return <BlockedAccount />
  if (!isAdmin) return <Navigate to={athleteHomePath(profile)} replace />
  if (assuranceLevel !== 'aal2') {
    const returnTo = `${location.pathname}${location.search}`
    const path = nextAssuranceLevel === 'aal2' ? '/login/mfa' : '/admin/security'
    return <Navigate to={`${path}?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }
  return <Outlet />
}

/** Allows an admin to enroll MFA before the final aal2 database gate is enabled. */
export function AdminSecurityRouteGuard() {
  const { session, profile, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex min-h-dvh items-center justify-center bg-background"><p className="text-sm text-text-secondary">Loading…</p></div>
  }
  if (!session) return <Navigate to="/login" replace />
  if (profile?.is_blocked) return <BlockedAccount />
  if (!isAdmin) return <Navigate to={athleteHomePath(profile)} replace />
  return <Outlet />
}
