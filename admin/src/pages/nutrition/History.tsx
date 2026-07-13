import { useNavigate } from 'react-router-dom'
import { ArrowRight, UtensilsCrossed } from 'lucide-react'
import { useMealHistory } from '../../nutrition/hooks'
import { groupByDay } from '../../nutrition/history'
import { sumMacros } from '../../nutrition/calc'
import { Card, EmptyState, SectionHeader, Shimmer } from '../../components/ui'

export default function History() {
  const navigate = useNavigate()
  const { data: logs, isLoading } = useMealHistory()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1].map((index) => <Shimmer key={index} className="h-20 w-full" />)}
      </div>
    )
  }

  const groups = groupByDay(logs ?? [])
  if (groups.length === 0) {
    return <EmptyState title="Zatiaľ žiadne záznamy" message="Tvoje zapísané jedlá sa zobrazia tu." />
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Your log</p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-[-0.035em] text-text-primary">História jedál</h2>
        <p className="mt-2 text-sm text-text-secondary">Prehľad všetkého, čo si si zapísal.</p>
      </div>
      {groups.map((group) => (
        <section key={group.date}>
          <SectionHeader title={group.date} />
          <div className="grid gap-3 lg:grid-cols-2">
            {group.logs.map((log) => {
              const totals = sumMacros(log.meal_log_foods)

              return (
                <Card
                  key={log.id}
                  className="group flex cursor-pointer items-center justify-between gap-4 p-5 transition-colors hover:bg-surface-highest"
                  onClick={() => navigate(`/nutrition/history/${log.id}`)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {log.image_url ? (
                      <img src={log.image_url} alt="" className="h-12 w-12 flex-shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface text-text-secondary"><UtensilsCrossed size={18} /></span>
                    )}
                    <div className="min-w-0">
                    <p className="font-semibold text-text-primary">{log.meal_name}</p>
                    <p className="text-xs text-text-secondary">
                      {new Date(log.logged_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-right"><span className="ds-metric-sm block text-text-primary">{Math.round(totals.calories)}</span><span className="text-[10px] uppercase tracking-wide text-text-secondary">kcal</span></span>
                    <ArrowRight size={17} className="text-text-secondary transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
