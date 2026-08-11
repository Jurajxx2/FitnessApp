import { NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowRightLeft,
  Dumbbell,
  LayoutDashboard,
  Library,
  MessageCircle,
  Moon,
  Quote,
  Salad,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { athleteHomePath } from '../lib/access'

const NAV_ITEMS = [
  { to: '/admin',           label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users',     label: 'Users',     icon: Users, end: false },
  { to: '/admin/workouts',  label: 'Workouts',  icon: Dumbbell, end: false },
  { to: '/admin/nutrition', label: 'Nutrition', icon: Salad, end: false },
  { to: '/admin/quotes',    label: 'Quotes',    icon: Quote, end: false },
  { to: '/admin/exercises', label: 'Exercises', icon: Library, end: false },
  { to: '/admin/chat',      label: 'Chat',      icon: MessageCircle, end: false },
  { to: '/admin/mfa',       label: 'Security',  icon: ShieldCheck, end: true },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
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
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1.5 rounded-full bg-accent-strong" aria-hidden="true" />
            <p className="font-display text-sm font-extrabold uppercase tracking-[0.13em] text-text-primary">Coach Foska</p>
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
          <p className="mb-2 px-3 ledger-label text-text-secondary">Manage</p>
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `relative flex min-h-10 items-center gap-3 rounded-xl pl-4 pr-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-surface-elevated font-semibold text-text-primary'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent-strong transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden="true"
                  />
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-outline-subtle p-3">
          <button
            type="button"
            onClick={() => { navigate(athleteHomePath(profile)); onClose() }}
            className="mb-2 flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl border border-outline bg-surface px-3 text-left text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
          >
            <ArrowRightLeft size={17} aria-hidden="true" />
            <span>User workspace</span>
          </button>
          <button
            onClick={toggleTheme}
            className="flex min-h-10 w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
          >
            <ThemeIcon size={17} aria-hidden="true" />
            <span>{theme === 'dark' ? 'Dark appearance' : 'Light appearance'}</span>
          </button>

          <div className="mt-2 flex items-center gap-3 rounded-xl bg-surface p-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-highest font-mono text-[11px] font-bold uppercase text-text-primary">
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
