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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const title = deriveTitle(location.pathname)

  return (
    <AdminLayoutContext.Provider value={{ setActions }}>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="flex items-center justify-between px-4 flex-shrink-0 border-b border-[var(--border)] bg-[var(--bg)]" style={{ height: '56px' }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden bg-transparent border-0 cursor-pointer text-[var(--text)] text-xl leading-none p-1"
                aria-label="Open menu"
              >
                ☰
              </button>
              <span className="font-semibold text-base text-[var(--text)]">{title}</span>
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </header>
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminLayoutContext.Provider>
  )
}
