import { useNavigate } from 'react-router-dom'
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
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.date}>
          <SectionHeader title={group.date} />
          <div className="flex flex-col gap-2">
            {group.logs.map((log) => {
              const totals = sumMacros(log.meal_log_foods)

              return (
                <Card
                  key={log.id}
                  className="flex cursor-pointer justify-between"
                  onClick={() => navigate(`/nutrition/history/${log.id}`)}
                >
                  <div>
                    <p className="font-semibold text-text-primary">{log.meal_name}</p>
                    <p className="text-xs text-text-secondary">
                      {new Date(log.logged_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="ds-metric-sm self-center text-text-primary">{Math.round(totals.calories)}</span>
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
