import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BlockedAccount } from './BlockedAccount'

export function AdminRouteGuard() {
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
  if (!isAdmin) return <Navigate to="/nutrition" replace />
  return <Outlet />
}
