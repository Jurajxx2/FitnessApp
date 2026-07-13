import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowRight, BarChart3, Clock3, Dumbbell, Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getActiveWorkout, getAssignedWorkouts, getWorkoutHistory, getWorkoutLibrary, startWorkout } from '../../activity/api'
import { buildWeek, DAY_SHORT, formatDuration, mondayIndex } from '../../activity/logic'
import type { WorkoutRow } from '../../activity/types'
import { useAuth } from '../../hooks/useAuth'
import { ActivityPage, ErrorBlock, LoadingBlock, PageIntro, SectionTitle, StartButton, WorkoutCard } from './shared'

const statusClass = {
  completed: 'border-success bg-success text-white',
  today: 'border-accent bg-accent/15 text-text-primary',
  missed: 'border-error/60 bg-error/10 text-error',
  scheduled: 'border-outline bg-surface text-text-primary',
  rest: 'border-outline-subtle bg-transparent text-text-secondary',
}

export default function ActivityHub() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const assignedQuery = useQuery({ queryKey: ['activity', 'assigned', userId], queryFn: () => getAssignedWorkouts(userId), enabled: Boolean(userId) })
  const libraryQuery = useQuery({ queryKey: ['activity', 'library'], queryFn: getWorkoutLibrary, enabled: Boolean(userId) })
  const historyQuery = useQuery({ queryKey: ['activity', 'history', userId], queryFn: () => getWorkoutHistory(userId), enabled: Boolean(userId) })
  const activeQuery = useQuery({ queryKey: ['activity', 'active', userId], queryFn: () => getActiveWorkout(userId), enabled: Boolean(userId) })

  const assigned = assignedQuery.data ?? []
  const library = libraryQuery.data ?? []
  const history = historyQuery.data ?? []
  const hasPlan = assigned.length > 0
  const plan = hasPlan ? assigned : library
  const week = buildWeek(assigned, history)
  const completedAssigned = week.filter(day => day.workout && day.log).length
  const scheduled = week.filter(day => day.workout).length
  const todayWorkout = assigned.find(workout => workout.day_of_week === mondayIndex(new Date())) ?? null
  const todaySummary = week[mondayIndex(new Date())]

  const startMutation = useMutation({
    mutationFn: (workout: WorkoutRow) => startWorkout(userId, workout),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activity', 'active', userId] })
      navigate('/activity/session')
    },
  })

  const isLoading = assignedQuery.isLoading || libraryQuery.isLoading || historyQuery.isLoading || activeQuery.isLoading
  const isError = assignedQuery.isError || libraryQuery.isError || historyQuery.isError || activeQuery.isError
  if (isLoading) return <ActivityPage><LoadingBlock /></ActivityPage>
  if (isError) return <ActivityPage><ErrorBlock /></ActivityPage>

  return (
    <ActivityPage>
      <PageIntro eyebrow="Training" title="Activity" description="Your plan, live workout tracking, exercise library, and progress in one place." />

      {activeQuery.data && (
        <button
          type="button"
          onClick={() => navigate('/activity/session')}
          className="flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-accent/50 bg-accent/10 p-5 text-left text-text-primary"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"><Play size={18} fill="currentColor" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wider text-text-accent">Workout in progress</span>
            <span className="mt-1 block truncate text-lg font-bold">{activeQuery.data.workout_name}</span>
          </span>
          <span className="text-sm font-semibold">Resume <ArrowRight className="ml-1 inline" size={16} /></span>
        </button>
      )}

      {hasPlan && (
        <section className="space-y-3">
          <SectionTitle title="This week" action={<span className="text-sm font-semibold text-text-secondary">{completedAssigned}/{scheduled} done</span>} />
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
            {week.map((day, index) => (
              <div key={day.date.toISOString()} className="min-w-0 text-center">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary">{DAY_SHORT[index]}</p>
                <div className={`mx-auto flex aspect-square max-w-12 items-center justify-center rounded-full border text-xs font-bold ${statusClass[day.status]}`}>
                  {day.status === 'completed' ? '✓' : day.date.getDate()}
                </div>
                <p className="mt-2 truncate text-[10px] text-text-secondary">{day.workout?.name ?? 'Rest'}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-outline bg-surface-elevated">
        {todayWorkout ? (
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-accent">
                {todaySummary?.log ? 'Completed today' : "Today's workout"}
              </p>
              <h3 className="mt-2 text-2xl font-bold text-text-primary">{todayWorkout.name}</h3>
              <p className="mt-2 text-sm text-text-secondary">
                {formatDuration(todayWorkout.duration_minutes)} · {todayWorkout.workout_exercises.length} exercises
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary">
                {todayWorkout.workout_exercises.slice(0, 4).map(item => item.name).join(' · ')}
              </p>
            </div>
            {todaySummary?.log ? (
              <Link to={`/activity/history/${todaySummary.log.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-outline px-5 text-sm font-semibold text-text-primary no-underline">View summary</Link>
            ) : (
              <StartButton pending={startMutation.isPending} onClick={() => startMutation.mutate(todayWorkout)} />
            )}
          </div>
        ) : (
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-accent">{hasPlan ? 'Rest day' : 'Start training'}</p>
              <h3 className="mt-2 text-2xl font-bold text-text-primary">{hasPlan ? 'Recover today. Keep the plan moving tomorrow.' : 'Choose a workout and make it count.'}</h3>
              <p className="mt-3 text-sm text-text-secondary">{hasPlan ? 'You can still log another activity if you go for a walk, run, ride, or swim.' : 'Browse the available plans or ask your coach to assign one.'}</p>
            </div>
            <Link to={hasPlan ? '/activity/log' : '/activity/workouts'} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-action-primary px-5 text-sm font-bold text-on-action-primary no-underline">
              {hasPlan ? 'Log activity' : 'Browse workouts'}
            </Link>
          </div>
        )}
        {startMutation.isError && <p role="alert" className="border-t border-error/30 bg-error/10 px-6 py-3 text-sm text-error">{startMutation.error.message}</p>}
      </section>

      <section className="space-y-3">
        <SectionTitle
          title={hasPlan ? 'Workout plan' : 'Available workouts'}
          action={<Link to="/activity/workouts" className="text-xs font-bold uppercase tracking-wider text-text-accent no-underline">See all</Link>}
        />
        {plan.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{plan.slice(0, 3).map(workout => <WorkoutCard key={workout.id} workout={workout} compact />)}</div>
        ) : (
          <div className="rounded-2xl border border-dashed border-outline p-6 text-sm text-text-secondary">No active workout plans are available yet.</div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: '/activity/exercises', label: 'Exercise library', detail: 'Browse form and technique', icon: Dumbbell },
          { to: '/activity/history', label: 'Workout history', detail: 'Review completed sessions', icon: Clock3 },
          { to: '/activity/progress', label: 'Progress', detail: 'See volume and consistency', icon: BarChart3 },
          { to: '/activity/log', label: 'Log activity', detail: 'Walk, run, ride, and more', icon: Activity },
        ].map(({ to, label, detail, icon: Icon }) => (
          <Link key={to} to={to} className="group flex items-center gap-3 rounded-2xl border border-outline bg-surface p-4 text-inherit no-underline hover:bg-surface-elevated">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-highest text-text-primary"><Icon size={19} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-text-primary">{label}</span><span className="mt-0.5 block truncate text-xs text-text-secondary">{detail}</span></span>
          </Link>
        ))}
      </section>
    </ActivityPage>
  )
}
