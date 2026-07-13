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
  const parts = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean)
  if (parts.length === 0) return 'Dashboard'
  if (parts[0] === 'users' && parts[1] === 'new') return 'Create athlete'
  if (parts[0] === 'users' && parts[1]) return 'Athlete profile'
  if (parts[0] === 'workouts' && parts[1] === 'new') return 'Create workout plan'
  if (parts[0] === 'workouts' && parts[1]) return 'Workout plan'
  if (parts[0] === 'exercises' && parts[1] === 'new') return 'Add exercise'
  if (parts[0] === 'exercises' && parts[1]) return 'Exercise'
  if (parts[0] === 'quotes' && parts[1] === 'new') return 'Add quote'
  if (parts[0] === 'quotes' && parts[1]) return 'Quote'
  if (parts[0] === 'nutrition' && parts[1] === 'recipes') return parts[2] === 'new' ? 'Add recipe' : 'Recipe'
  if (parts[0] === 'nutrition' && parts[1] === 'foods') return parts[2] === 'new' ? 'Add food' : 'Food'
  if (parts[0] === 'nutrition' && parts[1] === 'meal-plans') return parts[2] === 'new' ? 'Create meal plan' : 'Meal plan'
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
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
