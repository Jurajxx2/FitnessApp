import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock3, Dumbbell, Plus, TimerReset } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAssignedWorkouts, getWorkout, getWorkoutLibrary, startWorkout } from '../../activity/api'
import { formatDuration } from '../../activity/logic'
import type { WorkoutRow } from '../../activity/types'
import { useAuth } from '../../hooks/useAuth'
import { ActivityPage, ErrorBlock, ExerciseVisual, LoadingBlock, PageIntro, StartButton, WorkoutCard } from './shared'

const DAY_NAMES_SK = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota', 'Nedeľa']

export default function Workouts() {
  const { workoutId } = useParams()
  return workoutId ? <WorkoutDetail workoutId={workoutId} /> : <WorkoutList />
}

function WorkoutList() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
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
  if (assignedQuery.isLoading || libraryQuery.isLoading)
    return (
      <ActivityPage>
        <LoadingBlock label="Načítavajú sa tréningové plány…" />
      </ActivityPage>
    )
  if (assignedQuery.isError || libraryQuery.isError)
    return (
      <ActivityPage>
        <ErrorBlock message="Tréningové plány sa nepodarilo načítať." />
      </ActivityPage>
    )

  const allAssigned = assignedQuery.data ?? []
  const own = allAssigned.filter(workout => workout.source === 'user')
  const assigned = allAssigned.filter(workout => workout.source !== 'user')
  const library = libraryQuery.data ?? []
  const assignedIds = new Set(assigned.map(workout => workout.id))
  const additional = library.filter(workout => !assignedIds.has(workout.id))

  return (
    <ActivityPage>
      <PageIntro eyebrow="Aktivita" title="Tréningové plány" description={assigned.length ? 'Sleduj plán, ktorý ti pripravila trénerka, alebo si vytvor vlastný tréning.' : 'Vyber si dostupný tréning alebo si vytvor vlastný.'} action={<Link to="/activity/workouts/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-action-primary px-4 text-sm font-bold text-on-action-primary no-underline"><Plus size={17} /> Vytvoriť vlastný</Link>} />
      {own.length > 0 && (
        <section className="space-y-3">
          <div><h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">Moje tréningy</h3><p className="mt-1 text-sm text-text-secondary">Vlastné tréningy, ktoré si môžeš spustiť kedykoľvek.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{own.map(workout => <WorkoutCard key={workout.id} workout={workout} />)}</div>
        </section>
      )}
      {assigned.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">Tvoj plán</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assigned.map(workout => (
              <WorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        </section>
      )}
      {additional.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">{assigned.length ? 'Ďalšie tréningy' : 'Dostupné tréningy'}</h3>
            {assigned.length > 0 && <p className="mt-1 text-sm text-text-secondary">Voliteľné tréningy mimo prideleného plánu.</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {additional.map(workout => (
              <WorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        </section>
      )}
      {!assigned.length && !additional.length && !own.length && <div className="rounded-2xl border border-dashed border-outline p-8 text-center text-sm text-text-secondary">Nie sú dostupné žiadne aktívne tréningy. Vytvor si vlastný alebo požiadaj trénerku, aby ti priradila plán.</div>}
    </ActivityPage>
  )
}

function WorkoutDetail({ workoutId }: { workoutId: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const workoutQuery = useQuery({
    queryKey: ['activity', 'workout', workoutId],
    queryFn: () => getWorkout(workoutId),
    enabled: Boolean(userId)
  })
  const startMutation = useMutation({
    mutationFn: (workout: WorkoutRow) => startWorkout(userId, workout),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['activity', 'active', userId]
      })
      navigate('/activity/session')
    }
  })
  if (workoutQuery.isLoading)
    return (
      <ActivityPage>
        <LoadingBlock label="Načítava sa tréning…" />
      </ActivityPage>
    )
  if (workoutQuery.isError || !workoutQuery.data)
    return (
      <ActivityPage>
        <ErrorBlock message="Tento tréning sa nepodarilo načítať alebo nie je dostupný pre tvoj účet." />
      </ActivityPage>
    )
  const workout = workoutQuery.data

  return (
    <ActivityPage>
      <Link to="/activity/workouts" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary no-underline hover:text-text-primary">
        <ArrowLeft size={16} /> Všetky tréningy
      </Link>
      <div className="rounded-3xl border border-outline bg-surface-elevated p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-accent">{workout.day_of_week == null ? 'Ľubovoľný deň' : DAY_NAMES_SK[workout.day_of_week]}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary">{workout.name}</h2>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-text-secondary">
          <span className="inline-flex items-center gap-2">
            <Clock3 size={16} /> ~{formatDuration(workout.duration_minutes)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Dumbbell size={16} /> {workout.workout_exercises.length} cvikov
          </span>
        </div>
        {workout.notes && <p className="mt-5 max-w-3xl text-sm leading-6 text-text-secondary">{workout.notes}</p>}
        <div className="mt-6">
          <StartButton pending={startMutation.isPending} onClick={() => startMutation.mutate(workout)} />
        </div>
        {startMutation.isError && (
          <p role="alert" className="mt-3 text-sm text-error">
            {startMutation.error.message}
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">Prehľad tréningu</h3>
        <div className="space-y-3">
          {workout.workout_exercises.map((exercise, index) => (
            <div key={exercise.id} className="grid grid-cols-[3rem_1fr] gap-4 rounded-2xl border border-outline bg-surface p-4 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
              <ExerciseVisual exercise={exercise.exercise} name={exercise.name} className="h-12 w-12 rounded-xl sm:h-16 sm:w-16" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-secondary">
                  {index + 1}. {exercise.muscle_group ?? 'Cvik'}
                </p>
                <Link to={exercise.exercise_id ? `/activity/exercises/${exercise.exercise_id}` : '#'} className="mt-1 block truncate text-base font-bold text-text-primary no-underline">
                  {exercise.name}
                </Link>
                {exercise.tips && <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{exercise.tips}</p>}
              </div>
              <div className="col-span-2 flex gap-4 text-xs text-text-secondary sm:col-span-1 sm:text-right">
                <span>
                  {exercise.sets} × {exercise.log_type === 'time'
                    ? `${exercise.target_duration_seconds ?? 0}s`
                    : exercise.reps}
                </span>
                <span className="inline-flex items-center gap-1">
                  <TimerReset size={14} /> {exercise.rest_seconds}s
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </ActivityPage>
  )
}
