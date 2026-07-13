import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ChevronRight, History, LayoutDashboard, Plus } from 'lucide-react'
import { useDailySummary, useMacroTargets, useRecipes } from '../../nutrition/hooks'
import { todayIso } from '../../nutrition/date'
import { Card, SectionHeader, Button, Shimmer, MacroRing } from '../../components/ui'
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
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Your nutrition</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-[-0.035em] text-text-primary">Výživa</h2>
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
  const { data: recipes } = useRecipes()
  const featured = (recipes ?? []).filter(r => r.featured).slice(0, 5)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Daily overview</p>
        <h3 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-text-primary">Dnes</h3>
        <p className="mt-1 text-sm text-text-secondary">
          {new Intl.DateTimeFormat('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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

        <button type="button" onClick={() => navigate('/nutrition/history')} className="group flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border border-outline-subtle bg-surface-elevated p-4 text-left transition-colors hover:bg-surface-highest">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface text-text-primary"><History size={19} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-text-primary">História jedál</span>
            <span className="mt-0.5 block text-xs text-text-secondary">Skontrolovať záznamy a denné makrá</span>
          </span>
          <ChevronRight size={17} className="text-text-secondary transition-transform group-hover:translate-x-0.5" />
        </button>
      </section>

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
    </div>
  )
}
