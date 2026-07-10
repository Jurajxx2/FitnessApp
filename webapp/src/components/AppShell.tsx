import { NavLink, Outlet } from 'react-router-dom'
import { UtensilsCrossed, CalendarDays, BookOpen, History } from 'lucide-react'

const NAV = [
  { to: '/nutrition', label: 'Today', icon: UtensilsCrossed, end: true },
  { to: '/nutrition/plan', label: 'Plan', icon: CalendarDays, end: false },
  { to: '/nutrition/recipes', label: 'Recipes', icon: BookOpen, end: false },
  { to: '/nutrition/history', label: 'History', icon: History, end: false },
]

export function AppShell() {
  return (
    <div className="min-h-dvh bg-background flex justify-center">
      <div className="w-full max-w-[560px] flex flex-col min-h-dvh">
        <header className="sticky top-0 z-10 bg-background/90 backdrop-blur px-4 h-14 flex items-center border-b border-outline-subtle">
          <span className="text-xs font-bold tracking-widest text-text-primary uppercase">Coach Foska</span>
        </header>

        <main className="flex-1 px-4 pb-24 pt-4">
          <Outlet />
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
