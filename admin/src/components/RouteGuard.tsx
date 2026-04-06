import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AdminRouteGuard() {
  const { session, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[var(--text-muted)] text-sm">Loading…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/auth" replace />
  if (!isAdmin) return <Navigate to="/403" replace />
  return <Outlet />
}
