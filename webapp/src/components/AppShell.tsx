import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ClipboardCheck, History, LogOut, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageTransition } from './PageTransition'

const NAV = [
  { to: '/nutrition', label: 'Today', icon: UtensilsCrossed, end: true },
  { to: '/nutrition/plan', label: 'Meal plan', icon: CalendarDays, end: false },
  { to: '/nutrition/recipes', label: 'Recipes', icon: BookOpen, end: false },
  { to: '/nutrition/history', label: 'History', icon: History, end: false },
  { to: '/check-ins', label: 'Check-in', icon: ClipboardCheck, end: false },
]

function pageTitle(pathname: string) {
  if (pathname.startsWith('/nutrition/plan')) return 'Meal plan'
  if (pathname.startsWith('/nutrition/recipes')) return 'Recipes'
  if (pathname.startsWith('/nutrition/history')) return 'Nutrition history'
  if (pathname.startsWith('/nutrition/log')) return 'Log a meal'
  if (pathname.startsWith('/check-ins/history')) return 'Check-in history'
  if (pathname.startsWith('/check-ins')) return 'Weekly check-in'
  return 'Today'
}

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()
  const initials = (profile?.full_name || user?.email || 'CF')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden h-full w-64 flex-shrink-0 flex-col border-r border-outline-subtle bg-background md:flex">
        <div className="flex h-16 items-center border-b border-outline-subtle px-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-text-primary">Coach Foska</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Trainee workspace</p>
          </div>
        </div>
        <nav aria-label="Trainee navigation" className="flex flex-1 flex-col gap-1 px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-text-secondary">Your coaching</p>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${isActive ? 'bg-surface-elevated font-semibold text-text-primary' : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}>
              <Icon size={18} strokeWidth={1.8} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-outline-subtle p-3">
          <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-highest text-xs font-bold text-text-primary">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text-primary">{profile?.full_name || 'My account'}</p>
              <p className="truncate text-[11px] text-text-secondary">{user?.email}</p>
            </div>
            <button type="button" onClick={handleSignOut} aria-label="Sign out" className="border-0 bg-transparent p-1 text-text-secondary hover:text-error"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 flex-shrink-0 items-center border-b border-outline-subtle bg-background/95 px-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary md:hidden">Coach Foska</p>
            <h1 className="text-base font-semibold text-text-primary">{pageTitle(location.pathname)}</h1>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8"><PageTransition /></div>
        </main>
        <nav aria-label="Trainee navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-outline-subtle bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}>
              <Icon size={20} strokeWidth={1.9} /><span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
