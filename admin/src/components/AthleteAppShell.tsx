import { NavLink, useNavigate } from 'react-router-dom'
import { UtensilsCrossed, CalendarDays, BookOpen, History, ClipboardCheck, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { AthletePageTransition } from './AthletePageTransition'

const NAV = [
  { to: '/nutrition', label: 'Today', icon: UtensilsCrossed, end: true },
  { to: '/nutrition/plan', label: 'Plan', icon: CalendarDays, end: false },
  { to: '/nutrition/recipes', label: 'Recipes', icon: BookOpen, end: false },
  { to: '/nutrition/history', label: 'History', icon: History, end: false },
  { to: '/check-ins', label: 'Check-in', icon: ClipboardCheck, end: false },
]

export function AthleteAppShell() {
  const navigate = useNavigate()
  const { user } = useAuth()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-background flex justify-center">
      <div className="w-full max-w-[560px] flex flex-col min-h-dvh">
        <header className="sticky top-0 z-10 bg-background/90 backdrop-blur px-4 h-14 flex items-center justify-between gap-3 border-b border-outline-subtle">
          <span className="text-xs font-bold tracking-widest text-text-primary uppercase">Coach Foska</span>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden max-w-44 truncate text-xs text-text-secondary sm:block">{user?.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border border-outline bg-transparent px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
            >
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-4">
          <AthletePageTransition />
        </main>

        <nav className="fixed bottom-0 w-full max-w-[560px] bg-surface border-t border-outline-subtle flex">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2 text-[11px] ${
                  isActive ? 'text-text-primary' : 'text-text-secondary'
                }`
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
