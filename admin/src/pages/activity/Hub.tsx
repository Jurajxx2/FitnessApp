import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowRight, BarChart3, Clock3, Dumbbell, Play, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getActiveWorkout, getAssignedWorkouts, getWorkoutHistory, getWorkoutLibrary, startWorkout } from '../../activity/api'
import { buildWeek, formatDuration, mondayIndex, splitAssigned, weeklyProgress } from '../../activity/logic'
import type { WorkoutRow } from '../../activity/types'
import { useAuth } from '../../hooks/useAuth'
import { ActivityPage, ErrorBlock, LoadingBlock, PageIntro, SectionTitle, StartButton, WorkoutCard } from './shared'

const statusClass = {
  completed: 'border-success bg-success text-white',
  today: 'border-accent bg-accent/15 text-text-primary',
  missed: 'border-error/60 bg-error/10 text-error',
  scheduled: 'border-outline bg-surface text-text-primary',
  rest: 'border-outline-subtle bg-transparent text-text-secondary'
}

const DAY_SHORT_SK = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

export default function ActivityHub() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const assignedQuery = useQuery({
    queryKey: ['activity', 'assigned', userId],
    queryFn: () => getAssignedWorkouts(userId),
    enabled: Boolean(userId)
  })
  const libraryQuery = useQuery({
    queryKey: ['activity', 'library'],
    queryFn: getWorkoutLibrary,
    enabled: Boolean(userId)
  })
  const historyQuery = useQuery({
    queryKey: ['activity', 'history', userId],
    queryFn: () => getWorkoutHistory(userId),
    enabled: Boolean(userId)
  })
  const activeQuery = useQuery({
    queryKey: ['activity', 'active', userId],
    queryFn: () => getActiveWorkout(userId),
    enabled: Boolean(userId)
  })

  const allAssigned = assignedQuery.data ?? []
  const ownWorkouts = allAssigned.filter(workout => workout.source === 'user')
  const assigned = allAssigned.filter(workout => workout.source !== 'user')
  const library = libraryQuery.data ?? []
  const history = historyQuery.data ?? []
  const hasPlan = assigned.length > 0
  const plan = hasPlan ? assigned : library
  const { pinned, flexible } = splitAssigned(assigned)
  const week = buildWeek(pinned, history)
  const progress = weeklyProgress(assigned, history)
  const todayPinned = pinned.find(workout => workout.day_of_week === mondayIndex(new Date())) ?? null
  const todaySummary = week[mondayIndex(new Date())]
  const nextFlexible = progress.items.find(item => item.workout.day_of_week == null && !item.log)?.workout ?? null
  const todayWorkout = todayPinned ?? nextFlexible
  const todayDone = todayPinned ? Boolean(todaySummary?.log) : false

  const startMutation = useMutation({
    mutationFn: (workout: WorkoutRow) => startWorkout(userId, workout),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['activity', 'active', userId]
      })
      navigate('/activity/session')
    }
  })

  const isLoading = assignedQuery.isLoading || libraryQuery.isLoading || historyQuery.isLoading || activeQuery.isLoading
  const isError = assignedQuery.isError || libraryQuery.isError || historyQuery.isError || activeQuery.isError
  if (isLoading)
    return (
      <ActivityPage>
        <LoadingBlock />
      </ActivityPage>
    )
  if (isError)
    return (
      <ActivityPage>
        <ErrorBlock />
      </ActivityPage>
    )

  return (
    <ActivityPage>
      <PageIntro eyebrow="Tréning" title="Aktivita" description="Tvoj plán, sledovanie tréningu, knižnica cvikov a pokrok na jednom mieste." action={<Link to="/activity/workouts/new" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline bg-surface px-4 text-sm font-semibold text-text-primary no-underline hover:bg-surface-elevated"><Plus size={16} /> Vlastný tréning</Link>} />

      {activeQuery.data && (
        <button type="button" onClick={() => navigate('/activity/session')} className="flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-accent/50 bg-accent/10 p-5 text-left text-text-primary">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white">
            <Play size={18} fill="currentColor" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 ledger-label text-text-secondary">
              <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
              Prebiehajúci tréning
            </span>
            <span className="mt-1 block truncate text-lg font-bold">{activeQuery.data.workout_name}</span>
          </span>
          <span className="text-sm font-semibold">
            Pokračovať <ArrowRight className="ml-1 inline" size={16} />
          </span>
        </button>
      )}

      {hasPlan && (
        <section className="space-y-3">
          <SectionTitle
            title="Tento týždeň"
            action={
              <span className="text-sm font-semibold text-text-secondary">
                {progress.completed}/{progress.total} hotovo
              </span>
            }
          />
          {pinned.length > 0 && (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
              {week.map((day, index) => (
                <div key={day.date.toISOString()} className="min-w-0 text-center">
                  <p className="mb-2 ledger-label text-text-secondary">{DAY_SHORT_SK[index]}</p>
                  <div className={`mx-auto flex aspect-square max-w-12 items-center justify-center rounded-full border text-xs font-bold ${statusClass[day.status]}`}>{day.status === 'completed' ? '✓' : day.date.getDate()}</div>
                  <p className="mt-2 truncate text-[10px] text-text-secondary">{day.workout?.name ?? ''}</p>
                </div>
              ))}
            </div>
          )}
          {flexible.length > 0 && (
            <div className="space-y-2">
              {progress.items
                .filter(item => item.workout.day_of_week == null)
                .map(({ workout, log }) => (
                  <div key={workout.id} className={`flex items-center gap-3 rounded-2xl border p-4 ${log ? 'border-success/40 bg-success/5' : 'border-outline bg-surface-elevated'}`}>
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold ${log ? 'border-success bg-success text-white' : 'border-outline text-text-secondary'}`}>{log ? '✓' : ''}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-text-primary">{workout.name}</p>
                      <p className="text-xs text-text-secondary">
                        ~{formatDuration(workout.duration_minutes)} · {workout.workout_exercises.length} cvikov · ľubovoľný deň
                      </p>
                    </div>
                    {log ? (
                      <Link to={`/activity/history/${log.id}`} className="flex-shrink-0 text-xs font-semibold text-text-secondary no-underline hover:text-text-primary">
                        Zobraziť
                      </Link>
                    ) : (
                      <button type="button" disabled={startMutation.isPending} onClick={() => startMutation.mutate(workout)} className="min-h-9 flex-shrink-0 cursor-pointer rounded-xl border-0 bg-action-primary px-4 text-xs font-bold text-on-action-primary disabled:opacity-40">
                        Začať
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-outline bg-surface-elevated">
        {todayWorkout ? (
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8">
            <div>
              <p className="flex items-center gap-2 ledger-label text-text-secondary">
                <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
                {todayDone ? 'Dnes dokončené' : todayPinned ? 'Dnešný tréning' : 'Odporúčaný ďalší tréning'}
              </p>
              <h3 className="mt-2 text-2xl font-display font-bold tracking-tight text-text-primary">{todayWorkout.name}</h3>
              <p className="mt-2 text-sm text-text-secondary">
                ~{formatDuration(todayWorkout.duration_minutes)} · {todayWorkout.workout_exercises.length} cvikov
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary">
                {todayWorkout.workout_exercises
                  .slice(0, 4)
                  .map(item => item.name)
                  .join(' · ')}
              </p>
            </div>
            {todayDone && todaySummary?.log ? (
              <Link to={`/activity/history/${todaySummary.log.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-outline px-5 text-sm font-semibold text-text-primary no-underline">
                Zobraziť súhrn
              </Link>
            ) : (
              <StartButton pending={startMutation.isPending} onClick={() => startMutation.mutate(todayWorkout)} />
            )}
          </div>
        ) : (
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8">
            <div>
              <p className="flex items-center gap-2 ledger-label text-text-secondary">
                <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
                {hasPlan ? (progress.completed >= progress.total ? 'Tento týždeň hotovo' : 'Deň oddychu') : 'Začni trénovať'}
              </p>
              <h3 className="mt-2 text-2xl font-display font-bold tracking-tight text-text-primary">{hasPlan ? (progress.completed >= progress.total ? 'Plán je hotový. Oddýchni si a priprav sa na ďalší týždeň.' : 'Dnes si oddýchni. V pláne pokračuj zajtra.') : 'Vyber si tréning a pusť sa do toho.'}</h3>
              <p className="mt-3 text-sm text-text-secondary">{hasPlan ? 'Ak pôjdeš na prechádzku, beh, bicykel alebo plávať, môžeš si zapísať ďalšiu aktivitu.' : 'Pozri si dostupné plány alebo požiadaj trénerku, aby ti jeden priradila.'}</p>
            </div>
            <Link to={hasPlan ? '/activity/log' : '/activity/workouts'} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-action-primary px-5 text-sm font-bold text-on-action-primary no-underline">
              {hasPlan ? 'Zapísať aktivitu' : 'Prehliadnuť tréningy'}
            </Link>
          </div>
        )}
        {startMutation.isError && (
          <p role="alert" className="border-t border-error/30 bg-error/10 px-6 py-3 text-sm text-error">
            {startMutation.error.message}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle
          title={hasPlan ? 'Tréningový plán' : 'Dostupné tréningy'}
          action={
            <Link to="/activity/workouts" className="text-xs font-bold uppercase tracking-wider text-text-accent no-underline">
              Zobraziť všetky
            </Link>
          }
        />
        {plan.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plan.slice(0, 3).map(workout => (
              <WorkoutCard key={workout.id} workout={workout} compact />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-outline p-6 text-sm text-text-secondary">
            <p>Zatiaľ nie sú dostupné žiadne aktívne tréningové plány.</p>
            <Link to="/messages" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-action-primary px-4 text-sm font-bold text-on-action-primary no-underline">
              Napísať trénerke
            </Link>
          </div>
        )}
      </section>

      {ownWorkouts.length > 0 && (
        <section className="space-y-3">
          <SectionTitle title="Moje tréningy" action={<Link to="/activity/workouts" className="text-xs font-bold uppercase tracking-wider text-text-accent no-underline">Zobraziť všetky</Link>} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ownWorkouts.slice(0, 3).map(workout => <WorkoutCard key={workout.id} workout={workout} compact />)}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            to: '/activity/exercises',
            label: 'Knižnica cvikov',
            detail: 'Technika a prevedenie',
            icon: Dumbbell
          },
          {
            to: '/activity/history',
            label: 'História tréningov',
            detail: 'Prehľad dokončených tréningov',
            icon: Clock3
          },
          {
            to: '/activity/progress',
            label: 'Pokrok',
            detail: 'Objem a konzistentnosť',
            icon: BarChart3
          },
          {
            to: '/activity/log',
            label: 'Zapísať aktivitu',
            detail: 'Prechádzka, beh, bicykel a viac',
            icon: Activity
          }
        ].map(({ to, label, detail, icon: Icon }) => (
          <Link key={to} to={to} className="group flex items-center gap-3 rounded-2xl border border-outline bg-surface p-4 text-inherit no-underline hover:bg-surface-elevated">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-highest text-text-primary">
              <Icon size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-text-primary">{label}</span>
              <span className="mt-0.5 block truncate text-xs text-text-secondary">{detail}</span>
            </span>
          </Link>
        ))}
      </section>
    </ActivityPage>
  )
}
