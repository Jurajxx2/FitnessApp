import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { athleteHomePath, canAccessActivity, canAccessNutrition } from '../lib/access'
import { BlockedAccount } from './BlockedAccount'

export function AthleteRouteGuard() {
  const { session, profile, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) {
    return <div className="min-h-dvh bg-background flex items-center justify-center">
      <p className="text-text-secondary text-sm">Loading…</p>
    </div>
  }
  if (!session) return <Navigate to="/login" replace />
  if (profile?.is_blocked) return <BlockedAccount />
  if (location.pathname.startsWith('/nutrition') && !canAccessNutrition(profile)) {
    return <Navigate to={athleteHomePath(profile)} replace />
  }
  if (location.pathname.startsWith('/activity') && !canAccessActivity(profile)) {
    return <Navigate to={athleteHomePath(profile)} replace />
  }
  return <Outlet />
}
