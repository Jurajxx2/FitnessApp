import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock3, Dumbbell, TimerReset } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAssignedWorkouts, getWorkout, getWorkoutLibrary, startWorkout } from '../../activity/api'
import { DAY_NAMES, formatDuration } from '../../activity/logic'
import type { WorkoutRow } from '../../activity/types'
import { useAuth } from '../../hooks/useAuth'
import { ActivityPage, ErrorBlock, ExerciseVisual, LoadingBlock, PageIntro, StartButton, WorkoutCard } from './shared'

export default function Workouts() {
  const { workoutId } = useParams()
  return workoutId ? <WorkoutDetail workoutId={workoutId} /> : <WorkoutList />
}

function WorkoutList() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const assignedQuery = useQuery({ queryKey: ['activity', 'assigned', userId], queryFn: () => getAssignedWorkouts(userId), enabled: Boolean(userId) })
  const libraryQuery = useQuery({ queryKey: ['activity', 'library'], queryFn: getWorkoutLibrary, enabled: Boolean(userId) })
  if (assignedQuery.isLoading || libraryQuery.isLoading) return <ActivityPage><LoadingBlock label="Loading workout plans…" /></ActivityPage>
  if (assignedQuery.isError || libraryQuery.isError) return <ActivityPage><ErrorBlock message="Workout plans could not be loaded." /></ActivityPage>

  const assigned = assignedQuery.data ?? []
  const library = libraryQuery.data ?? []
  const assignedIds = new Set(assigned.map(workout => workout.id))
  const additional = library.filter(workout => !assignedIds.has(workout.id))

  return (
    <ActivityPage>
      <PageIntro eyebrow="Activity" title="Workout plans" description={assigned.length ? 'Follow the plan your coach prepared. Other available workouts remain clearly separated below.' : 'Pick an available workout to start training.'} />
      {assigned.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">Your plan</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{assigned.map(workout => <WorkoutCard key={workout.id} workout={workout} />)}</div>
        </section>
      )}
      {additional.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">{assigned.length ? 'Other workouts' : 'Available workouts'}</h3>
            {assigned.length > 0 && <p className="mt-1 text-sm text-text-secondary">Optional workouts outside your assigned plan.</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{additional.map(workout => <WorkoutCard key={workout.id} workout={workout} />)}</div>
        </section>
      )}
      {!assigned.length && !additional.length && <div className="rounded-2xl border border-dashed border-outline p-8 text-center text-sm text-text-secondary">No active workouts are available. Ask your coach to assign a plan.</div>}
    </ActivityPage>
  )
}

function WorkoutDetail({ workoutId }: { workoutId: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const workoutQuery = useQuery({ queryKey: ['activity', 'workout', workoutId], queryFn: () => getWorkout(workoutId), enabled: Boolean(userId) })
  const startMutation = useMutation({
    mutationFn: (workout: WorkoutRow) => startWorkout(userId, workout),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activity', 'active', userId] })
      navigate('/activity/session')
    },
  })
  if (workoutQuery.isLoading) return <ActivityPage><LoadingBlock label="Loading workout…" /></ActivityPage>
  if (workoutQuery.isError || !workoutQuery.data) return <ActivityPage><ErrorBlock message="This workout could not be loaded or is not available to your account." /></ActivityPage>
  const workout = workoutQuery.data

  return (
    <ActivityPage>
      <Link to="/activity/workouts" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary no-underline hover:text-text-primary"><ArrowLeft size={16} /> All workouts</Link>
      <div className="rounded-3xl border border-outline bg-surface-elevated p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-accent">{workout.day_of_week == null ? 'Flexible day' : DAY_NAMES[workout.day_of_week]}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary">{workout.name}</h2>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-text-secondary">
          <span className="inline-flex items-center gap-2"><Clock3 size={16} /> {formatDuration(workout.duration_minutes)}</span>
          <span className="inline-flex items-center gap-2"><Dumbbell size={16} /> {workout.workout_exercises.length} exercises</span>
        </div>
        {workout.notes && <p className="mt-5 max-w-3xl text-sm leading-6 text-text-secondary">{workout.notes}</p>}
        <div className="mt-6"><StartButton pending={startMutation.isPending} onClick={() => startMutation.mutate(workout)} /></div>
        {startMutation.isError && <p role="alert" className="mt-3 text-sm text-error">{startMutation.error.message}</p>}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">Session outline</h3>
        <div className="space-y-3">
          {workout.workout_exercises.map((exercise, index) => (
            <div key={exercise.id} className="grid grid-cols-[3rem_1fr] gap-4 rounded-2xl border border-outline bg-surface p-4 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
              <ExerciseVisual exercise={exercise.exercise} name={exercise.name} className="h-12 w-12 rounded-xl sm:h-16 sm:w-16" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-secondary">{index + 1}. {exercise.muscle_group ?? 'Exercise'}</p>
                <Link to={exercise.exercise_id ? `/activity/exercises/${exercise.exercise_id}` : '#'} className="mt-1 block truncate text-base font-bold text-text-primary no-underline">{exercise.name}</Link>
                {exercise.tips && <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{exercise.tips}</p>}
              </div>
              <div className="col-span-2 flex gap-4 text-xs text-text-secondary sm:col-span-1 sm:text-right">
                <span>{exercise.sets} × {exercise.reps}</span>
                <span className="inline-flex items-center gap-1"><TimerReset size={14} /> {exercise.rest_seconds}s</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </ActivityPage>
  )
}
