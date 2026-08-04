import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ChevronRight, History, LayoutDashboard, Play, Plus } from 'lucide-react'
import {
  useActiveQuote, useDailyLogs, useDailySummary, useFeaturedRecipes, useMacroTargets, useTodayPlannedMeals,
} from '../../nutrition/hooks'
import { todayIso } from '../../nutrition/date'
import { sumMacros } from '../../nutrition/calc'
import { useAuth } from '../../hooks/useAuth'
import { getActiveWorkout, getAssignedWorkouts } from '../../activity/api'
import { Card, SectionHeader, Button, EmptyState, Shimmer, MacroRing } from '../../components/ui'
import Plan from './Plan'
import Recipes from './Recipes'

const TABS = [
  { label: 'Dnes', to: '/nutrition', icon: LayoutDashboard },
  { label: 'Jedálniček', to: '/nutrition/plan', icon: CalendarDays },
  { label: 'Recepty', to: '/nutrition/recipes', icon: BookOpen },
] as const

export default function Hub() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeTab = location.pathname === '/nutrition/plan'
    ? 'plan'
    : location.pathname === '/nutrition/recipes'
      ? 'recipes'
      : 'today'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 ledger-label text-text-secondary">
            <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
            Your nutrition
          </p>
          <h2 className="mt-1 text-3xl font-display font-bold tracking-tight text-text-primary">Výživa</h2>
          <p className="mt-2 text-sm text-text-secondary">Denné ciele, jedálniček a recepty na jednom mieste.</p>
        </div>
        <Button onClick={() => navigate('/nutrition/log')} className="w-full sm:w-auto">
          <Plus size={17} /> Zapísať jedlo
        </Button>
      </div>

      <nav aria-label="Nutrition sections" className="grid grid-cols-3 gap-1 rounded-2xl border border-outline-subtle bg-surface-elevated p-1.5">
        {TABS.map(({ label, to, icon: Icon }) => {
          const selected = to === '/nutrition'
            ? activeTab === 'today'
            : location.pathname === to
          return (
            <button
              key={to}
              type="button"
              aria-current={selected ? 'page' : undefined}
              onClick={() => navigate(to)}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 px-2 text-xs font-semibold transition-colors sm:text-sm ${selected ? 'bg-surface-highest text-text-primary shadow-sm' : 'bg-transparent text-text-secondary hover:text-text-primary'}`}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'today' && <TodayOverview />}
      {activeTab === 'plan' && <Plan embedded />}
      {activeTab === 'recipes' && <Recipes embedded />}
    </div>
  )
}

function TodayOverview() {
  const navigate = useNavigate()
  const { data: summary, isLoading } = useDailySummary(todayIso())
  const targets = useMacroTargets()
  const { data: featured = [] } = useFeaturedRecipes()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="flex items-center gap-2 ledger-label text-text-secondary">
          <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
          Daily overview
        </p>
        <h3 className="mt-1 text-2xl font-display font-bold tracking-tight text-text-primary">Dnes</h3>
        <p className="mt-1 text-sm text-text-secondary">
          {new Intl.DateTimeFormat('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
      </div>

      <DailyQuoteBlock />

      <Card className="p-5 sm:p-6">
        <SectionHeader title="Denné ciele" />
        {isLoading ? (
          <div className="grid grid-cols-2 place-items-center gap-5 sm:grid-cols-4">
            <Shimmer className="w-24 h-24 rounded-full" />
            <Shimmer className="w-24 h-24 rounded-full" />
            <Shimmer className="w-24 h-24 rounded-full" />
            <Shimmer className="w-24 h-24 rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-2 place-items-center gap-x-4 gap-y-6 sm:grid-cols-4">
            <MacroRing label="Kcal" value={summary.calories} target={targets?.calories} unit="" />
            <MacroRing label="Bielk." value={summary.protein_g} target={targets?.protein_g} unit="g" />
            <MacroRing label="Sach." value={summary.carbs_g} target={targets?.carbs_g} unit="g" />
            <MacroRing label="Tuky" value={summary.fat_g} target={targets?.fat_g} unit="g" />
          </div>
        )}
      </Card>

      <LoggedMealsBlock />
      <PlannedMealsBlock />
      <NextWorkoutBlock />

      {featured.length > 0 && (
        <section>
          <SectionHeader title="Odporúčané recepty" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {featured.map(r => (
              <Card key={r.id} className="group cursor-pointer overflow-hidden p-0" onClick={() => navigate(`/nutrition/recipes/${r.id}`)}>
                <div className="aspect-[16/10] overflow-hidden bg-surface-highest">
                  {r.photo_url ? <img src={r.photo_url} alt={r.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-text-secondary"><BookOpen size={24} /></div>}
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 text-sm font-semibold text-text-primary">{r.name}</p>
                  <p className="mt-1 text-xs text-text-secondary">{Math.round(r.calories)} kcal · B {Math.round(r.protein_g)}g</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <button type="button" onClick={() => navigate('/nutrition/history')} className="group flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border border-outline-subtle bg-surface-elevated p-4 text-left transition-colors hover:bg-surface-highest">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface text-text-primary"><History size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">História jedál</span>
          <span className="mt-0.5 block text-xs text-text-secondary">Skontrolovať záznamy a denné makrá</span>
        </span>
        <ChevronRight size={17} className="text-text-secondary transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  )
}

function DailyQuoteBlock() {
  const { data: quote, isLoading } = useActiveQuote()

  if (isLoading) return <Shimmer className="h-20 w-full" />
  if (!quote) return null

  return (
    <Card className="p-5 sm:p-6">
      <p className="italic text-text-primary">{quote.text}</p>
      {quote.author && <p className="mt-2 text-sm text-text-secondary">— {quote.author}</p>}
    </Card>
  )
}

function LoggedMealsBlock() {
  const { data: logs, isLoading } = useDailyLogs(todayIso())

  if (isLoading) return <Shimmer className="h-32 w-full" />

  const sorted = [...(logs ?? [])].sort((a, b) => a.logged_at.localeCompare(b.logged_at))

  return (
    <section>
      <SectionHeader title="Dnešné jedlá" />
      {sorted.length === 0 ? (
        <EmptyState
          title="Dnes si ešte nemáš zapísané žiadne jedlo."
          action={
            <Link to="/nutrition/log" className="inline-flex min-h-11 items-center rounded-xl bg-action-primary px-4 text-sm font-bold text-on-action-primary no-underline">
              Zapísať jedlo
            </Link>
          }
        />
      ) : (
        <Card className="p-2 sm:p-3">
          <ul className="flex flex-col divide-y divide-outline-subtle">
            {sorted.map(log => {
              const kcal = Math.round(sumMacros(log.meal_log_foods).calories)
              const time = new Date(log.logged_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
              return (
                <li key={log.id}>
                  <Link
                    to={`/nutrition/history/${log.id}`}
                    className="flex min-h-11 items-center justify-between gap-4 rounded-lg px-2 py-2.5 text-sm no-underline outline-none transition-colors hover:bg-surface-highest focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-text-primary">{log.meal_name}</span>
                      <span className="text-xs text-text-secondary">{time}</span>
                    </span>
                    <span className="flex-shrink-0 text-text-secondary">{kcal} kcal</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </section>
  )
}

function PlannedMealsBlock() {
  const { data: meals, isLoading } = useTodayPlannedMeals()

  if (isLoading) return <Shimmer className="h-32 w-full" />
  if (!meals || meals.length === 0) return null

  return (
    <section>
      <SectionHeader title="Dnešný jedálniček" />
      <Card className="p-2 sm:p-3">
        <ul className="flex flex-col divide-y divide-outline-subtle">
          {meals.map(meal => {
            const kcal = Math.round(sumMacros(meal.meal_foods).calories)
            const recipeNames = meal.meal_foods.map(f => f.name).join(', ')
            return (
              <li key={meal.id} className="flex min-h-11 items-center justify-between gap-4 px-2 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text-primary">{meal.name}</span>
                  {recipeNames && <span className="block truncate text-xs text-text-secondary">{recipeNames}</span>}
                </span>
                <span className="flex-shrink-0 text-text-secondary">{kcal} kcal</span>
              </li>
            )
          })}
        </ul>
      </Card>
    </section>
  )
}

function NextWorkoutBlock() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const assignedQuery = useQuery({
    queryKey: ['activity', 'assigned', userId],
    queryFn: () => getAssignedWorkouts(userId),
    enabled: Boolean(userId),
  })
  const activeQuery = useQuery({
    queryKey: ['activity', 'active', userId],
    queryFn: () => getActiveWorkout(userId),
    enabled: Boolean(userId),
  })

  if (assignedQuery.isLoading || activeQuery.isLoading) return <Shimmer className="h-24 w-full" />

  const activeWorkout = activeQuery.data
  const nextWorkout = assignedQuery.data?.[0]
  if (!activeWorkout && !nextWorkout) return null

  return (
    <section>
      <SectionHeader title="Ďalší tréning" />
      <Card className="flex items-center gap-4 p-5 sm:p-6">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-surface-highest text-text-primary">
          <Play size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {activeWorkout ? (
            <>
              <p className="ledger-label text-text-secondary">Prebiehajúci tréning</p>
              <p className="mt-1 truncate text-base font-bold text-text-primary">{activeWorkout.workout_name}</p>
            </>
          ) : (
            <p className="truncate text-base font-bold text-text-primary">{nextWorkout!.name}</p>
          )}
        </div>
        <Link
          to={activeWorkout ? '/activity/session' : `/activity/workouts/${nextWorkout!.id}`}
          className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-xl bg-action-primary px-4 text-sm font-bold text-on-action-primary no-underline"
        >
          {activeWorkout ? 'Pokračovať' : 'Začať tréning'}
        </Link>
      </Card>
    </section>
  )
}
