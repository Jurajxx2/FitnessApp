import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BarChart3, ChevronRight, Clock3, Dumbbell } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getWorkoutHistory, getWorkoutLog } from '../../activity/api'
import { completedSets, formatDate, formatDuration, workoutVolume } from '../../activity/logic'
import { useAuth } from '../../hooks/useAuth'
import { ActivityPage, ErrorBlock, LoadingBlock, PageIntro } from './shared'

export default function WorkoutHistory() {
  const { logId } = useParams()
  return logId ? <HistoryDetail logId={logId} /> : <HistoryList />
}

function HistoryList() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const historyQuery = useQuery({ queryKey: ['activity', 'history', userId], queryFn: () => getWorkoutHistory(userId), enabled: Boolean(userId) })
  if (historyQuery.isLoading) return <ActivityPage><LoadingBlock label="Loading workout history…" /></ActivityPage>
  if (historyQuery.isError) return <ActivityPage><ErrorBlock message="Workout history could not be loaded." /></ActivityPage>
  const history = historyQuery.data ?? []

  return (
    <ActivityPage>
      <PageIntro eyebrow="Activity" title="Workout history" description="Review completed sessions, sets, reps, weights, and training volume." action={<Link to="/activity/progress" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline px-4 text-sm font-semibold text-text-primary no-underline"><BarChart3 size={16} /> Progress</Link>} />
      {history.length ? (
        <div className="space-y-3">
          {history.map(log => {
            const volume = workoutVolume(log)
            return (
              <Link key={log.id} to={`/activity/history/${log.id}`} className="flex items-center gap-4 rounded-2xl border border-outline bg-surface-elevated p-4 text-inherit no-underline hover:bg-surface-highest sm:p-5">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-surface-highest text-text-primary"><Dumbbell size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-text-primary">{log.workout_name}</span>
                  <span className="mt-1 block text-xs text-text-secondary">{formatDate(log.logged_at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span className="mt-2 flex flex-wrap gap-3 text-xs text-text-secondary"><span>{formatDuration(log.duration_minutes)}</span><span>{completedSets(log)} sets</span>{volume > 0 && <span>{Math.round(volume).toLocaleString()} kg volume</span>}</span>
                </span>
                <ChevronRight size={18} className="text-text-secondary" />
              </Link>
            )
          })}
        </div>
      ) : <div className="rounded-2xl border border-dashed border-outline p-8 text-center"><p className="font-semibold text-text-primary">No completed workouts yet</p><p className="mt-1 text-sm text-text-secondary">Start a workout and complete at least one set to build your history.</p><Link to="/activity/workouts" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-action-primary px-4 text-sm font-bold text-on-action-primary no-underline">Choose a workout</Link></div>}
    </ActivityPage>
  )
}

function HistoryDetail({ logId }: { logId: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const logQuery = useQuery({ queryKey: ['activity', 'history', userId, logId], queryFn: () => getWorkoutLog(userId, logId), enabled: Boolean(userId) })
  if (logQuery.isLoading) return <ActivityPage><LoadingBlock label="Loading session summary…" /></ActivityPage>
  if (logQuery.isError || !logQuery.data) return <ActivityPage><ErrorBlock message="This workout summary could not be loaded." /></ActivityPage>
  const log = logQuery.data
  const volume = workoutVolume(log)

  return (
    <ActivityPage>
      <Link to="/activity/history" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary no-underline hover:text-text-primary"><ArrowLeft size={16} /> Workout history</Link>
      <div className="rounded-3xl border border-outline bg-surface-elevated p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-success">Workout complete</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary">{log.workout_name}</h2>
        <p className="mt-2 text-sm text-text-secondary">{formatDate(log.logged_at, { dateStyle: 'full', timeStyle: 'short' })}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Duration" value={formatDuration(log.duration_minutes)} icon={<Clock3 size={17} />} />
          <Metric label="Exercises" value={String(log.exercise_logs.length)} icon={<Dumbbell size={17} />} />
          <Metric label="Completed sets" value={String(completedSets(log))} />
          <Metric label="Volume" value={volume ? `${Math.round(volume).toLocaleString()} kg` : '—'} />
        </div>
        {log.notes && <p className="mt-5 rounded-xl bg-surface p-4 text-sm leading-6 text-text-secondary">{log.notes}</p>}
      </div>
      <div className="space-y-4">
        {log.exercise_logs.map(exercise => (
          <section key={exercise.id} className="overflow-hidden rounded-2xl border border-outline bg-surface-elevated">
            <div className="p-5"><h3 className="font-bold text-text-primary">{exercise.exercise_name}</h3><p className="mt-1 text-xs text-text-secondary">{exercise.set_logs.filter(set => set.completed).length || exercise.sets_completed || 0} completed sets</p></div>
            {exercise.set_logs.length > 0 ? (
              <div className="border-t border-outline-subtle px-5 pb-4">
                <div className="grid grid-cols-5 gap-2 py-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary"><span>Set</span><span>Reps</span><span>Weight</span><span>Time</span><span>RPE</span></div>
                {exercise.set_logs.map(set => (
                  <div key={set.id} className={`grid grid-cols-5 gap-2 border-t border-outline-subtle py-3 text-sm ${set.completed ? 'text-text-primary' : 'text-text-secondary'}`}>
                    <span className="font-semibold">{set.sort_order}</span><span>{set.actual_reps ?? '—'}</span><span>{set.actual_weight_kg != null ? `${set.actual_weight_kg} kg` : '—'}</span><span>{set.actual_duration_seconds != null ? `${set.actual_duration_seconds}s` : '—'}</span><span>{set.rpe ?? '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="border-t border-outline-subtle p-5 text-sm text-text-secondary">Legacy entry: {exercise.sets_completed ?? 0} sets · {exercise.reps_completed ?? 'reps not recorded'} · {exercise.weight_kg != null ? `${exercise.weight_kg} kg` : 'weight not recorded'}</p>
            )}
          </section>
        ))}
      </div>
    </ActivityPage>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div className="rounded-2xl bg-surface p-4"><p className="flex items-center gap-2 text-xs text-text-secondary">{icon}{label}</p><p className="mt-2 text-xl font-bold text-text-primary">{value}</p></div>
}
