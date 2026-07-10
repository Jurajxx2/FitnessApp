import { createContext, useContext, useState } from 'react'
import { Menu } from 'lucide-react'
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
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-outline-subtle bg-background px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="cursor-pointer border-0 bg-transparent p-1 text-text-primary md:hidden"
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>
              <span className="text-base font-semibold text-text-primary">{title}</span>
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
