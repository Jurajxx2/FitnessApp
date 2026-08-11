import { Navigate, Outlet } from 'react-router-dom'
import { useAuth, useAuthAssurance } from '../hooks/useAuth'
import { BlockedAccount } from './BlockedAccount'
import { athleteHomePath } from '../lib/access'

export function AdminRouteGuard() {
  const { session, profile, isAdmin, isLoading } = useAuth()
  const assurance = useAuthAssurance()

  if (isLoading || assurance.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (profile?.is_blocked) return <BlockedAccount />
  if (!isAdmin) return <Navigate to={athleteHomePath(profile)} replace />
  if (assurance.error || assurance.currentLevel !== 'aal2') return <Navigate to="/admin/mfa" replace />
  return <Outlet />
}

export function AdminMfaRouteGuard() {
  const { session, profile, isAdmin, isLoading } = useAuth()

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
  return <Outlet />
}
