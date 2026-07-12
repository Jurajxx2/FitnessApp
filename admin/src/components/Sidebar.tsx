import { NavLink, useNavigate } from 'react-router-dom'
import {
  Dumbbell,
  ExternalLink,
  LayoutDashboard,
  Library,
  MessageCircle,
  Moon,
  Quote,
  Salad,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getAthleteAppUrl } from '../lib/athleteApp'

const NAV_ITEMS = [
  { to: '/admin',           label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users',     label: 'Users',     icon: Users, end: false },
  { to: '/admin/workouts',  label: 'Workouts',  icon: Dumbbell, end: false },
  { to: '/admin/nutrition', label: 'Nutrition', icon: Salad, end: false },
  { to: '/admin/quotes',    label: 'Quotes',    icon: Quote, end: false },
  { to: '/admin/exercises', label: 'Exercises', icon: Library, end: false },
  { to: '/admin/chat',      label: 'Chat',      icon: MessageCircle, end: false },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const athleteAppUrl = getAthleteAppUrl()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/auth', { replace: true })
  }

  const ThemeIcon = theme === 'dark' ? Moon : Sun

  return (
    <>
      {isOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-shrink-0 flex-col border-r border-outline bg-background transition-transform duration-300 md:relative md:z-auto md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex h-16 items-center justify-between border-b border-outline-subtle px-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-text-primary">Coach Foska</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-text-secondary">Admin workspace</p>
          </div>
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="cursor-pointer border-0 bg-transparent p-1 text-text-secondary hover:text-text-primary md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-text-secondary">Workspace</p>
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-surface-elevated font-semibold text-text-primary'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-outline-subtle p-3">
          {athleteAppUrl && (
            <a
              href={athleteAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="mb-2 flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
            >
              <ExternalLink size={17} aria-hidden="true" />
              <span className="flex-1">Open athlete app</span>
              <span className="text-[10px] uppercase tracking-wider">Preview</span>
            </a>
          )}
          <button
            onClick={toggleTheme}
            className="flex min-h-10 w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
          >
            <ThemeIcon size={17} aria-hidden="true" />
            <span>{theme === 'dark' ? 'Dark appearance' : 'Light appearance'}</span>
          </button>

          <div className="mt-2 flex items-center gap-3 rounded-xl bg-surface p-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-highest text-xs font-bold uppercase text-text-primary">
              {user?.email?.slice(0, 2) ?? 'CF'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text-primary">{user?.email ?? 'Coach Foska'}</p>
              <button onClick={handleSignOut} className="mt-0.5 cursor-pointer border-0 bg-transparent p-0 text-[11px] text-text-secondary hover:text-error">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
