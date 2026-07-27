import { useQuery } from '@tanstack/react-query'
import { Activity, CalendarCheck, Clock3, Dumbbell } from 'lucide-react'
import { getGeneralActivities, getWorkoutHistory } from '../../activity/api'
import { startOfWeek, workoutVolume } from '../../activity/logic'
import { useAuth } from '../../hooks/useAuth'
import { ActivityPage, ErrorBlock, LoadingBlock, PageIntro } from './shared'

function weekKey(date: Date) {
  return startOfWeek(date).toISOString().slice(0, 10)
}

export default function Progress() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const historyQuery = useQuery({
    queryKey: ['activity', 'history', userId],
    queryFn: () => getWorkoutHistory(userId),
    enabled: Boolean(userId)
  })
  const activityQuery = useQuery({
    queryKey: ['activity', 'general', userId],
    queryFn: () => getGeneralActivities(userId),
    enabled: Boolean(userId)
  })
  if (historyQuery.isLoading || activityQuery.isLoading)
    return (
      <ActivityPage>
        <LoadingBlock label="Vypočítava sa pokrok…" />
      </ActivityPage>
    )
  if (historyQuery.isError || activityQuery.isError)
    return (
      <ActivityPage>
        <ErrorBlock message="Pokrok sa nepodarilo vypočítať." />
      </ActivityPage>
    )
  const history = historyQuery.data ?? []
  const activities = activityQuery.data ?? []
  const thisWeek = startOfWeek(new Date())
  const thisWeekLogs = history.filter(log => new Date(log.logged_at) >= thisWeek)
  const totalMinutes = history.reduce((total, log) => total + log.duration_minutes, 0) + activities.reduce((total, item) => total + item.duration_minutes, 0)
  const totalVolume = history.reduce((total, log) => total + workoutVolume(log), 0)
  const weeks = Array.from({ length: 8 }, (_, reverseIndex) => {
    const date = new Date(thisWeek)
    date.setDate(date.getDate() - (7 - reverseIndex) * 7)
    const key = weekKey(date)
    return {
      key,
      label: new Intl.DateTimeFormat('sk-SK', {
        month: 'short',
        day: 'numeric'
      }).format(date),
      count: history.filter(log => weekKey(new Date(log.logged_at)) === key).length
    }
  })
  const maxCount = Math.max(1, ...weeks.map(week => week.count))
  let streak = 0
  for (let index = weeks.length - 1; index >= 0; index -= 1) {
    if (weeks[index].count === 0) break
    streak += 1
  }

  return (
    <ActivityPage>
      <PageIntro eyebrow="Aktivita" title="Pokrok" description="Praktický prehľad konzistentnosti, času tréningu a zaznamenaného objemu." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<CalendarCheck size={19} />} label="Tento týždeň" value={`${thisWeekLogs.length} tréningov`} />
        <Metric icon={<Dumbbell size={19} />} label="Všetky tréningy" value={String(history.length)} />
        <Metric icon={<Clock3 size={19} />} label="Čas tréningu" value={`${Math.round(totalMinutes / 60)}h`} />
        <Metric icon={<Activity size={19} />} label="Tréningový objem" value={totalVolume ? `${Math.round(totalVolume / 100) / 10}k kg` : '—'} />
      </div>
      <section className="rounded-2xl border border-outline bg-surface-elevated p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Tréningy za týždeň</h3>
            <p className="mt-1 text-sm text-text-secondary">Posledných osem týždňov</p>
          </div>
          <p className="text-sm font-semibold text-text-secondary">{streak}-týždňová séria</p>
        </div>
        <div className="mt-6 grid h-56 grid-cols-8 items-end gap-2 sm:gap-4">
          {weeks.map(week => (
            <div key={week.key} className="flex h-full min-w-0 flex-col justify-end text-center">
              <span className="mb-2 text-xs font-bold text-text-primary">{week.count || ''}</span>
              <div
                className="mx-auto w-full max-w-10 rounded-t-lg bg-accent transition-[height]"
                style={{
                  height: `${Math.max(week.count ? 12 : 2, (week.count / maxCount) * 100)}%`
                }}
              />
              <span className="mt-2 truncate text-[9px] text-text-secondary sm:text-[10px]">{week.label}</span>
            </div>
          ))}
        </div>
      </section>
      {!history.length && <div className="rounded-2xl border border-dashed border-outline p-8 text-center text-sm text-text-secondary">Dokonči prvý tréning, aby sa začal zobrazovať vývoj pokroku.</div>}
    </ActivityPage>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline bg-surface-elevated p-4 sm:p-5">
      <span className="text-text-accent">{icon}</span>
      <p className="mt-4 text-xs font-semibold text-text-secondary">{label}</p>
      <p className="mt-1 text-xl font-display font-bold tabular-nums text-text-primary sm:text-2xl">{value}</p>
    </div>
  )
}
