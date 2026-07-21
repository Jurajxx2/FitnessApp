import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button, ClickableRow, ConfirmDialog, EmptyState, PageHeader, SearchInput, Table, Td, Th, useNotice } from '../../components/ui'
import type { Workout, WorkoutExercise } from '../../types/database'
import { createExerciseDraftId } from '../../workouts/builder'

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export type ExerciseDraft = Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at'> & {
  client_id: string
  image_url: string | null
  image_url_2: string | null
}

export const blankExercise = (): ExerciseDraft => ({
  client_id: createExerciseDraftId(),
  exercise_id: null,
  name: '',
  muscle_group: '',
  sets: 3,
  reps: '10',
  log_type: 'weight_reps',
  target_duration_seconds: null,
  rest_seconds: 60,
  tips: '',
  sort_order: 0,
  image_url: null,
  image_url_2: null,
})

export function exerciseHasData(exercise: ExerciseDraft): boolean {
  const blank = blankExercise()
  return Boolean(exercise.exercise_id)
    || Boolean(exercise.muscle_group?.trim())
    || Boolean(exercise.tips?.trim())
    || exercise.sets !== blank.sets
    || exercise.reps !== blank.reps
    || exercise.rest_seconds !== blank.rest_seconds
}

export function findBlankNamedExerciseRows(exercises: ExerciseDraft[]): number[] {
  return exercises
    .map((_, index) => index)
    .filter(index => !exercises[index].name.trim() && exerciseHasData(exercises[index]))
}

export function describeInvalidExerciseRows(rowIndexes: number[]): string {
  if (!rowIndexes.length) return ''
  const rowNumbers = rowIndexes.map(index => index + 1).join(', ')
  const rowWord = rowIndexes.length === 1 ? 'Exercise' : 'Exercises'
  const verb = rowIndexes.length === 1 ? 'has' : 'have'
  return `${rowWord} ${rowNumbers} ${verb} details but no exercise name. Add a name or remove the row before saving.`
}

type WorkoutWithCount = Workout & { exercise_count: number }

function useWorkouts() {
  return useQuery<WorkoutWithCount[]>({
    queryKey: ['workouts-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*, workout_exercises(id)')
        .eq('source', 'coach')
        .order('name')
      if (error) throw error
      return (data ?? []).map(workout => ({
        ...workout,
        exercise_count: (workout.workout_exercises as { id: string }[]).length,
      }))
    },
  })
}

export default function Workouts() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const { data: workouts = [], isLoading, isError } = useWorkouts()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Workout | null>(null)

  const visibleWorkouts = workouts.filter(workout => workout.name.toLowerCase().includes(search.trim().toLowerCase()))

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts-admin'] })
      setDeleteTarget(null)
      notify('Workout plan deleted.')
    },
    onError: error => notify(`Couldn’t delete workout plan: ${error.message}`, 'error'),
  })

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Workouts"
        description="Build reusable training plans and assign them to athletes."
        actions={<Button onClick={() => navigate('/admin/workouts/new')}>Create plan</Button>}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={event => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search workout plans…"
          className="w-full sm:max-w-sm"
        />
        {!isLoading && <p className="text-sm text-text-secondary">{visibleWorkouts.length} of {workouts.length} plans</p>}
      </div>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : isError ? (
        <EmptyState title="Workout plans couldn’t be loaded" description="Refresh the page to retry." />
      ) : visibleWorkouts.length === 0 ? (
        <EmptyState
          title={search ? 'No workout plans match this search' : 'No workout plans yet'}
          description={search ? 'Try a different plan name.' : 'Create a plan to start assigning training to athletes.'}
          action={!search ? <Button onClick={() => navigate('/admin/workouts/new')}>Create workout plan</Button> : undefined}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Day</Th>
              <Th>Exercises</Th>
              <Th>Estimated time</Th>
              <Th>Status</Th>
              <Th><span className="sr-only">Actions</span></Th>
            </tr>
          </thead>
          <tbody>
            {visibleWorkouts.map(workout => (
              <ClickableRow key={workout.id} label={`Open ${workout.name}`} onActivate={() => navigate(`/admin/workouts/${workout.id}`)}>
                <Td className="font-semibold text-text-primary">{workout.name}</Td>
                <Td>{workout.day_of_week !== null ? DAYS[workout.day_of_week] : 'Any day'}</Td>
                <Td>{workout.exercise_count} exercises</Td>
                <Td>{workout.duration_minutes > 0 ? `~${workout.duration_minutes} min` : '—'}</Td>
                <Td>{workout.is_active ? <span className="text-xs text-success">Active</span> : <span className="text-xs text-text-secondary">Inactive</span>}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" className="min-h-9 px-3" onClick={() => navigate(`/admin/workouts/${workout.id}`)}>
                      Open <ChevronRight size={15} aria-hidden="true" />
                    </Button>
                    <Button variant="danger" className="min-h-9 px-3" onClick={() => setDeleteTarget(workout)}>Delete</Button>
                  </div>
                </Td>
              </ClickableRow>
            ))}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete workout plan?"
        description={<>“{deleteTarget?.name}” will be permanently removed. Athletes will no longer see this plan.</>}
        pending={deleteWorkout.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteWorkout.mutate(deleteTarget.id)}
      />
    </div>
  )
}
