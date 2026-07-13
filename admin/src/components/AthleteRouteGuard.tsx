import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BlockedAccount } from './BlockedAccount'

export function AthleteRouteGuard() {
  const { session, profile, isLoading } = useAuth()
  if (isLoading) {
    return <div className="min-h-dvh bg-background flex items-center justify-center">
      <p className="text-text-secondary text-sm">Loading…</p>
    </div>
  }
  if (!session) return <Navigate to="/login" replace />
  if (profile?.is_blocked) return <BlockedAccount />
  return <Outlet />
}
