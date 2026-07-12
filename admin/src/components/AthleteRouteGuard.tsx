import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AthleteRouteGuard() {
  const { session, isLoading } = useAuth()
  if (isLoading) {
    return <div className="min-h-dvh bg-background flex items-center justify-center">
      <p className="text-text-secondary text-sm">Loading…</p>
    </div>
  }
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
