import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AdminRouteGuard() {
  const { session, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/auth" replace />
  if (!isAdmin) return <Navigate to="/403" replace />
  return <Outlet />
}
