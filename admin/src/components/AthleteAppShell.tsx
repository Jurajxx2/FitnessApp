import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRightLeft,
  ClipboardCheck,
  Dumbbell,
  LogOut,
  Moon,
  Sun,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { canAccessActivity, canAccessNutrition } from '../lib/access'
import { AthletePageTransition } from './AthletePageTransition'

const NAV = [
  { to: '/nutrition', label: 'Nutrition', icon: UtensilsCrossed, end: false, feature: 'nutrition' },
  { to: '/activity', label: 'Activity', icon: Dumbbell, end: false, feature: 'activity' },
  { to: '/check-ins', label: 'Check-in', icon: ClipboardCheck, end: false, feature: 'shared' },
  { to: '/profile', label: 'Profile', icon: UserRound, end: true, feature: 'shared' },
]

function pageTitle(pathname: string) {
  if (pathname.startsWith('/activity/session')) return 'Workout session'
  if (pathname.startsWith('/activity/exercises')) return 'Exercise library'
  if (pathname.startsWith('/activity/history')) return 'Workout history'
  if (pathname.startsWith('/activity/progress')) return 'Progress'
  if (pathname.startsWith('/activity/log')) return 'Log activity'
  if (pathname.startsWith('/activity/workouts')) return 'Workout plans'
  if (pathname.startsWith('/activity')) return 'Activity'
  if (pathname.startsWith('/nutrition/history')) return 'Nutrition history'
  if (pathname.startsWith('/nutrition/log')) return 'Log a meal'
  if (pathname.startsWith('/nutrition/recipes/')) return 'Recipe detail'
  if (pathname.startsWith('/nutrition')) return 'Nutrition'
  if (pathname.startsWith('/check-ins/history')) return 'Check-in history'
  if (pathname.startsWith('/check-ins')) return 'Weekly check-in'
  if (pathname.startsWith('/profile')) return 'Profile'
  return 'Nutrition'
}

export function AthleteAppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, isAdmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const initials = (profile?.full_name || user?.email || 'CF')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
  const visibleNav = NAV.filter(item =>
    item.feature === 'shared'
    || (item.feature === 'nutrition' && canAccessNutrition(profile))
    || (item.feature === 'activity' && canAccessActivity(profile))
  )

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const ThemeIcon = theme === 'dark' ? Moon : Sun

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden h-full w-64 flex-shrink-0 flex-col border-r border-outline-subtle bg-background md:flex">
        <div className="flex h-16 items-center border-b border-outline-subtle px-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-text-primary">Coach Foska</p>
        </div>

        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-text-secondary">Your coaching</p>
          {visibleNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                isActive
                  ? 'bg-surface-elevated font-semibold text-text-primary'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-outline-subtle p-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="mb-2 flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl border border-outline bg-surface px-3 text-left text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
            >
              <ArrowRightLeft size={17} aria-hidden="true" /> Admin workspace
            </button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
          >
            <ThemeIcon size={17} /> {theme === 'dark' ? 'Dark appearance' : 'Light appearance'}
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-surface p-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-highest text-xs font-bold text-text-primary">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text-primary">{profile?.full_name || 'My account'}</p>
              <p className="truncate text-[11px] text-text-secondary">{user?.email}</p>
            </div>
            <button type="button" onClick={handleSignOut} aria-label="Sign out" className="cursor-pointer border-0 bg-transparent p-1 text-text-secondary hover:text-error">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-outline-subtle bg-background/95 px-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary md:hidden">Coach Foska</p>
            <h1 className="text-base font-semibold text-text-primary">{pageTitle(location.pathname)}</h1>
          </div>
          {isAdmin && (
            <button type="button" onClick={() => navigate('/admin')} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border border-outline bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-elevated md:hidden">
              <ArrowRightLeft size={15} aria-hidden="true" /> Admin
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <AthletePageTransition />
          </div>
        </main>

        <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-outline-subtle bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {visibleNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}
            >
              <Icon size={20} strokeWidth={1.9} />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
