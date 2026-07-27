import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  ArrowLeft,
  ClipboardCheck,
  Dumbbell,
  LogOut,
  MessageCircle,
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
import { countUnreadFromCoach, fetchMyMessages } from '../chat/athleteApi'

const NAV = [
  { to: '/nutrition', label: 'Výživa', icon: UtensilsCrossed, end: false, feature: 'nutrition' },
  { to: '/activity', label: 'Tréning', icon: Dumbbell, end: false, feature: 'activity' },
  { to: '/check-ins', label: 'Check-in', icon: ClipboardCheck, end: false, feature: 'shared' },
  { to: '/messages', label: 'Správy', icon: MessageCircle, end: true, feature: 'shared' },
  { to: '/profile', label: 'Profil', icon: UserRound, end: true, feature: 'shared' },
]

function pageTitle(pathname: string) {
  if (pathname.startsWith('/activity/session')) return 'Tréning'
  if (pathname.startsWith('/activity/exercises')) return 'Knižnica cvikov'
  if (pathname.startsWith('/activity/history')) return 'História tréningov'
  if (pathname.startsWith('/activity/progress')) return 'Pokrok'
  if (pathname.startsWith('/activity/log')) return 'Zapísať aktivitu'
  if (pathname.startsWith('/activity/workouts')) return 'Tréningové plány'
  if (pathname.startsWith('/activity')) return 'Tréning'
  if (pathname.startsWith('/nutrition/history')) return 'História jedál'
  if (pathname.startsWith('/nutrition/log')) return 'Zapísať jedlo'
  if (pathname.startsWith('/nutrition/recipes/')) return 'Detail receptu'
  if (pathname.startsWith('/nutrition')) return 'Výživa'
  if (pathname.startsWith('/check-ins/history')) return 'História check-inov'
  if (pathname.startsWith('/check-ins')) return 'Týždenný check-in'
  if (pathname.startsWith('/messages')) return 'Správy'
  if (pathname.startsWith('/profile')) return 'Profil'
  return 'Výživa'
}

export function athleteBackTarget(pathname: string): string | null {
  if (/^\/activity\/workouts\/(new|[^/]+)$/.test(pathname)) return '/activity/workouts'
  if (/^\/activity\/(session|workouts|exercises|history|progress|log)$/.test(pathname)) return '/activity'
  if (/^\/activity\/(exercises|history)\/[^/]+$/.test(pathname)) return `/activity/${pathname.split('/')[2]}`
  if (/^\/nutrition\/(recipes|history)\/[^/]+$/.test(pathname)) return `/nutrition/${pathname.split('/')[2]}`
  if (/^\/nutrition\/(history|log)$/.test(pathname)) return '/nutrition'
  if (pathname === '/check-ins/history') return '/check-ins'
  return null
}

export function AthleteAppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, isAdmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const unreadQuery = useQuery({
    queryKey: ['athlete-chat-unread', user?.id ?? ''],
    enabled: Boolean(user?.id),
    refetchInterval: 60_000,
    queryFn: async () => countUnreadFromCoach(await fetchMyMessages(user!.id)),
  })
  const unread = unreadQuery.data ?? 0
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
  const backTarget = athleteBackTarget(location.pathname)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const ThemeIcon = theme === 'dark' ? Moon : Sun

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden h-full w-64 flex-shrink-0 flex-col border-r border-outline-subtle bg-background md:flex">
        <div className="flex h-16 items-center border-b border-outline-subtle px-5">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1.5 rounded-full bg-accent-strong" aria-hidden="true" />
            <p className="font-display text-sm font-extrabold uppercase tracking-[0.13em] text-text-primary">Coach Foska</p>
          </div>
        </div>

        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 px-3 py-5">
          <p className="mb-2 px-3 ledger-label text-text-secondary">Tvoj koučing</p>
          {visibleNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `relative flex min-h-11 items-center gap-3 rounded-xl pl-4 pr-3 text-sm transition-colors ${
                isActive
                  ? 'bg-surface-elevated font-semibold text-text-primary'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent-strong transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden="true"
                  />
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  {label}
                  {to === '/messages' && unread > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-strong px-1 font-mono text-[10px] font-bold text-on-accent">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </>
              )}
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
              <ArrowRightLeft size={17} aria-hidden="true" /> Administrácia
            </button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
          >
            <ThemeIcon size={17} /> {theme === 'dark' ? 'Tmavý vzhľad' : 'Svetlý vzhľad'}
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-surface p-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-highest text-xs font-bold text-text-primary">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text-primary">{profile?.full_name || 'Môj účet'}</p>
              <p className="truncate text-[11px] text-text-secondary">{user?.email}</p>
            </div>
            <button type="button" onClick={handleSignOut} aria-label="Odhlásiť sa" className="cursor-pointer border-0 bg-transparent p-1 text-text-secondary hover:text-error">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-outline-subtle bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {backTarget && (
              <button
                type="button"
                onClick={() => navigate(backTarget)}
                aria-label="Späť"
                className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border border-outline bg-surface text-text-primary transition-colors hover:bg-surface-elevated"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            )}
            <div className="min-w-0">
              <p className="ledger-label text-text-secondary md:hidden">Coach Foska</p>
              <h1 className="truncate font-display text-lg font-bold tracking-tight text-text-primary">{pageTitle(location.pathname)}</h1>
            </div>
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
              className={({ isActive }) => `relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-full bg-accent-strong transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden="true"
                  />
                  <span className="relative">
                    <Icon size={20} strokeWidth={1.9} />
                    {to === '/messages' && unread > 0 && (
                      <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-strong px-1 font-mono text-[9px] font-bold text-on-accent">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </span>
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
