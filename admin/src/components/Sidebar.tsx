import { NavLink, useNavigate } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { to: '/admin',           label: 'Dashboard', icon: '▪',  end: true },
  { to: '/admin/users',     label: 'Users',     icon: '👥', end: false },
  { to: '/admin/workouts',  label: 'Workouts',  icon: '🏋️', end: false },
  { to: '/admin/nutrition', label: 'Nutrition', icon: '🥗', end: false },
  { to: '/admin/quotes',     label: 'Quotes',    icon: '💬', end: false },
  { to: '/admin/exercises',  label: 'Exercises', icon: '💪', end: false },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-50 w-[200px] flex-shrink-0 flex flex-col
        bg-[var(--sidebar-bg)] border-r border-[var(--border)]
        transition-transform duration-300
        md:relative md:translate-x-0 md:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-4 pt-5 pb-2 flex items-center justify-between">
          <span className="text-xs font-extrabold tracking-widest text-[var(--text)] uppercase">Coach Foska</span>
          <button
            onClick={onClose}
            className="md:hidden text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer text-lg leading-none"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
          <p className="text-[9px] font-bold text-[var(--text-disabled)] uppercase tracking-widest px-3 mb-1">Menu</p>
          {NAV_ITEMS.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors ${
                  isActive
                    ? 'bg-[var(--sidebar-active-bg)] text-[var(--text)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`
              }
            >
              <span className="text-sm w-4 text-center">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-[var(--border)] flex flex-col gap-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2.5 px-2 py-1.5 w-full bg-transparent border-0 cursor-pointer text-left"
          >
            <div className="relative w-8 h-4 rounded-full bg-[var(--border)] flex-shrink-0">
              <div className={`absolute top-0.5 w-3 h-3 bg-[var(--text)] rounded-full transition-all ${theme === 'light' ? 'left-4' : 'left-0.5'}`} />
            </div>
            <span className="text-xs text-[var(--text-muted)]">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>

          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-7 h-7 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] flex-shrink-0 font-bold uppercase">
              {user?.email?.slice(0, 2) ?? 'CF'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
              <button onClick={handleSignOut} className="text-[10px] text-[var(--text-disabled)] hover:text-red-400 bg-transparent border-0 cursor-pointer p-0">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
