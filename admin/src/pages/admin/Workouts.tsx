import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button, ConfirmDialog, DataTable, EmptyState, PageHeader, SearchInput, useNotice } from '../../components/ui'
import type { ActionMenuItem, BulkAction, DataColumn } from '../../components/ui'
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
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)

  const visibleWorkouts = workouts.filter(workout => workout.name.toLowerCase().includes(search.trim().toLowerCase()))

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts-admin'] })
    },
  })

  const deleteTargets = deleteIds ? workouts.filter(workout => deleteIds.includes(workout.id)) : []

  async function confirmDelete() {
    if (!deleteIds) return
    setDeleting(true)
    try {
      await Promise.all(deleteIds.map(id => deleteWorkout.mutateAsync(id)))
      notify(deleteIds.length > 1 ? `${deleteIds.length} workout plans deleted.` : 'Workout plan deleted.')
      setDeleteIds(null)
    } catch (error) {
      notify(`Couldn’t delete workout plan${deleteIds.length > 1 ? 's' : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns: DataColumn<WorkoutWithCount>[] = [
    { key: 'name', header: 'Name', className: 'font-semibold text-text-primary', render: workout => workout.name },
    { key: 'day', header: 'Day', render: workout => (workout.day_of_week !== null ? DAYS[workout.day_of_week] : 'Any day') },
    { key: 'exercises', header: 'Exercises', render: workout => `${workout.exercise_count} exercises` },
    { key: 'time', header: 'Estimated time', render: workout => (workout.duration_minutes > 0 ? `~${workout.duration_minutes} min` : '—') },
    {
      key: 'status',
      header: 'Status',
      render: workout => (workout.is_active ? <span className="text-xs text-success">Active</span> : <span className="text-xs text-text-secondary">Inactive</span>),
    },
  ]

  const rowActions = (workout: WorkoutWithCount): ActionMenuItem[] => [
    { key: 'open', label: 'Open', onSelect: () => navigate(`/admin/workouts/${workout.id}`) },
    { key: 'delete', label: 'Delete', variant: 'danger', icon: <Trash2 size={16} />, onSelect: () => setDeleteIds([workout.id]) },
  ]

  const bulkActions = (selected: WorkoutWithCount[]): BulkAction[] => [
    { key: 'delete', label: 'Delete', variant: 'danger', icon: <Trash2 size={16} />, onClick: () => setDeleteIds(selected.map(workout => workout.id)) },
  ]

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

      {isError ? (
        <EmptyState title="Workout plans couldn’t be loaded" description="Refresh the page to retry." />
      ) : (
        <DataTable<WorkoutWithCount>
          rows={visibleWorkouts}
          getRowId={workout => workout.id}
          columns={columns}
          rowLabel={workout => `Open ${workout.name}`}
          onRowActivate={workout => navigate(`/admin/workouts/${workout.id}`)}
          rowActions={rowActions}
          selectable
          bulkActions={bulkActions}
          loading={isLoading}
          empty={
            <EmptyState
              title={search ? 'No workout plans match this search' : 'No workout plans yet'}
              description={search ? 'Try a different plan name.' : 'Create a plan to start assigning training to athletes.'}
              action={!search ? <Button onClick={() => navigate('/admin/workouts/new')}>Create workout plan</Button> : undefined}
            />
          }
        />
      )}

      <ConfirmDialog
        open={deleteIds !== null}
        title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} workout plans?` : 'Delete workout plan?'}
        description={
          deleteIds && deleteIds.length > 1 ? (
            <>{deleteIds.length} workout plans will be permanently removed. Athletes will no longer see these plans.</>
          ) : deleteTargets[0] ? (
            <>“{deleteTargets[0].name}” will be permanently removed. Athletes will no longer see this plan.</>
          ) : (
            <>This plan will be permanently removed. Athletes will no longer see this plan.</>
          )
        }
        pending={deleting}
        onClose={() => setDeleteIds(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
