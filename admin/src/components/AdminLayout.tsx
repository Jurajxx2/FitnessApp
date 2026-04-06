import { createContext, useContext, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'

interface AdminLayoutContextValue {
  setActions: (actions: React.ReactNode) => void
}

export const AdminLayoutContext = createContext<AdminLayoutContextValue>({
  setActions: () => {},
})

export function useAdminLayoutActions() {
  return useContext(AdminLayoutContext)
}

function deriveTitle(pathname: string): string {
  const segment = pathname.replace(/^\/admin\/?/, '').split('/')[0]
  if (!segment) return 'Dashboard'
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

export function AdminLayout() {
  const [actions, setActions] = useState<React.ReactNode>(null)
  const location = useLocation()
  const title = deriveTitle(location.pathname)

  return (
    <AdminLayoutContext.Provider value={{ setActions }}>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header
            style={{
              height: '56px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
              padding: '0 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)' }}>
              {title}
            </span>
            {actions && <div style={{ display: 'flex', gap: '0.5rem' }}>{actions}</div>}
          </header>
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminLayoutContext.Provider>
  )
}
