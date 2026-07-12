// admin/src/pages/admin/Workouts.tsx
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button, ConfirmDialog, EmptyState, Input, Modal, PageHeader, SearchInput, Table, Th, Td, useNotice } from '../../components/ui'
import { ExerciseCombobox } from '../../components/ExerciseCombobox'
import { ExerciseBrowserSlideOver } from '../../components/ExerciseBrowserSlideOver'
import { AssignUsersDialog } from '../../components/AssignUsersDialog'
import type { Workout, WorkoutExercise } from '../../types/database'
import type { Profile } from '../../types/database'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type WorkoutWithCount = Workout & { exercise_count: number }

function useWorkouts() {
  return useQuery<WorkoutWithCount[]>({
    queryKey: ['workouts-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*, workout_exercises(id)')
        .order('name')
      if (error) throw error
      return (data ?? []).map(w => ({
        ...w,
        exercise_count: (w.workout_exercises as { id: string }[]).length,
      }))
    },
  })
}

function useProfiles() {
  return useQuery<Pick<Profile, 'id' | 'email' | 'full_name' | 'is_admin' | 'is_blocked'>[]>({
    queryKey: ['profiles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, is_admin, is_blocked')
        .order('full_name')
      if (error) throw error
      return data ?? []
    },
  })
}

type ExerciseDraft = Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at'>

const blankExercise = (): ExerciseDraft => ({
  exercise_id: null, name: '', muscle_group: '', sets: 3, reps: '10', rest_seconds: 60, tips: '', sort_order: 0,
})

// A row is "meaningfully filled" if it carries any detail beyond the default
// blank-row state. An entirely default/blank row is fine to drop silently, but
// a row that has data yet no exercise name must never be silently dropped —
// that would save fewer exercises than the coach sees on screen.
export function exerciseHasData(exercise: ExerciseDraft): boolean {
  const blank = blankExercise()
  return Boolean(exercise.exercise_id)
    || Boolean(exercise.muscle_group?.trim())
    || Boolean(exercise.tips?.trim())
    || exercise.sets !== blank.sets
    || exercise.reps !== blank.reps
    || exercise.rest_seconds !== blank.rest_seconds
}

// Row indexes (0-based) that carry data but are missing the required name. These
// block the save so the coach must name or remove them — the same policy the
// recipe editor applies to ingredient rows.
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

interface WorkoutFormState {
  name: string
  day_of_week: number | null
  notes: string
  is_active: boolean
}

export default function Workouts() {
  const qc = useQueryClient()
  const { notify } = useNotice()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: workouts = [], isLoading, isError } = useWorkouts()
  const { data: profiles = [] } = useProfiles()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Workout | null>(null)
  const [form, setForm] = useState<WorkoutFormState>({ name: '', day_of_week: null, notes: '', is_active: true })
  const [exercises, setExercises] = useState<ExerciseDraft[]>([blankExercise()])
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Workout | null>(null)

  const visibleWorkouts = workouts.filter(workout => workout.name.toLowerCase().includes(search.trim().toLowerCase()))

  function openCreate() {
    setEditing(null)
    setForm({ name: '', day_of_week: null, notes: '', is_active: true })
    setExercises([blankExercise()])
    setAssignedUserIds([])
    setEditorOpen(true)
  }

  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    openCreate()
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  async function openEdit(w: Workout) {
    setEditing(w)
    setForm({ name: w.name, day_of_week: w.day_of_week, notes: w.notes ?? '', is_active: w.is_active })
    const [exerciseResult, assignmentResult] = await Promise.all([
      supabase
        .from('workout_exercises')
        .select('*')
        .eq('workout_id', w.id)
        .order('sort_order'),
      supabase
        .from('user_workouts')
        .select('user_id')
        .eq('workout_id', w.id),
    ])
    if (exerciseResult.error) {
      notify(`Couldn’t load ${w.name}: ${exerciseResult.error.message}`, 'error')
      return
    }
    if (assignmentResult.error) {
      notify(`Couldn’t load assignments: ${assignmentResult.error.message}`, 'error')
      return
    }
    const data = exerciseResult.data
    setExercises(data?.map(e => ({
      exercise_id: e.exercise_id ?? null, name: e.name, muscle_group: e.muscle_group ?? '',
      sets: e.sets, reps: e.reps, rest_seconds: e.rest_seconds, tips: e.tips ?? '', sort_order: e.sort_order,
    })) ?? [blankExercise()])

    setAssignedUserIds((assignmentResult.data ?? []).map(a => a.user_id))
    setEditorOpen(true)
  }

  const saveWorkout = useMutation({
    mutationFn: async () => {
      // Block the save if any row has data but no name, rather than silently
      // dropping it — keeps what is saved identical to what the coach sees.
      const invalidRows = findBlankNamedExerciseRows(exercises)
      if (invalidRows.length) {
        throw new Error(describeInvalidExerciseRows(invalidRows))
      }

      const validExercises = exercises.filter(exercise => exercise.name.trim())
      let workoutId: string
      if (editing) {
        const { error: updateErr } = await supabase.from('workouts').update({ ...form }).eq('id', editing.id)
        if (updateErr) throw updateErr
        const { error: deleteErr } = await supabase.from('workout_exercises').delete().eq('workout_id', editing.id)
        if (deleteErr) throw deleteErr
        if (validExercises.length) {
          const { error: insertErr } = await supabase.from('workout_exercises').insert(
            validExercises.map((e, i) => ({ ...e, workout_id: editing.id, sort_order: i }))
          )
          if (insertErr) throw insertErr
        }
        workoutId = editing.id
      } else {
        const { data: w, error } = await supabase
          .from('workouts')
          .insert({ ...form })
          .select()
          .single()
        if (error) throw error
        if (validExercises.length) {
          const { error: exerciseError } = await supabase.from('workout_exercises').insert(
            validExercises.map((e, i) => ({ ...e, workout_id: w.id, sort_order: i }))
          )
          if (exerciseError) throw exerciseError
        }
        workoutId = w.id
      }

      // Sync user_workouts
      const { data: currentRows, error: currentRowsError } = await supabase
        .from('user_workouts')
        .select('user_id')
        .eq('workout_id', workoutId)
      if (currentRowsError) throw currentRowsError
      const currentIds = new Set((currentRows ?? []).map(r => r.user_id))
      const newIds = new Set(assignedUserIds)
      const toAdd = assignedUserIds.filter(uid => !currentIds.has(uid))
      const toRemove = [...currentIds].filter(uid => !newIds.has(uid))
      if (toAdd.length) {
        const { error } = await supabase.from('user_workouts').insert(
          toAdd.map(uid => ({ workout_id: workoutId, user_id: uid }))
        )
        if (error) throw error
      }
      if (toRemove.length) {
        const { error } = await supabase.from('user_workouts').delete()
          .eq('workout_id', workoutId)
          .in('user_id', toRemove)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts-admin'] })
      setEditorOpen(false)
      setSlideOverOpen(false)
      notify(editing ? 'Workout plan saved.' : 'Workout plan created.')
    },
    onError: (error) => notify(`Couldn’t save workout plan: ${error.message}`, 'error'),
  })

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts-admin'] })
      setDeleteTarget(null)
      notify('Workout plan deleted.')
    },
    onError: error => notify(`Couldn’t delete workout plan: ${error.message}`, 'error'),
  })

  function updateExercise(i: number, field: keyof ExerciseDraft, value: string | number) {
    setExercises(ex => ex.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  function updateExerciseName(i: number, name: string, muscleGroup: string, exerciseId: string) {
    setExercises(ex => ex.map((e, idx) =>
      idx === i ? { ...e, name, exercise_id: exerciseId || null, ...(muscleGroup ? { muscle_group: muscleGroup } : {}) } : e
    ))
  }

  function removeExercise(i: number) {
    setExercises(ex => ex.filter((_, idx) => idx !== i))
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Workouts" description="Create and assign coaching plans." actions={<Button onClick={openCreate}>+ Create plan</Button>} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={search} onChange={event => setSearch(event.target.value)} onClear={() => setSearch('')} placeholder="Search workout plans…" className="w-full sm:max-w-sm" />
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
          action={!search ? <Button onClick={openCreate}>Create workout plan</Button> : undefined}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Day</Th>
              <Th>Exercises</Th>
              <Th>Status</Th>
              <Th>{''}</Th>
            </tr>
          </thead>
          <tbody>
            {visibleWorkouts.map(w => (
              <tr key={w.id} className="hover:bg-surface-highest">
                <Td className="font-semibold text-text-primary">{w.name}</Td>
                <Td>{w.day_of_week !== null ? DAYS[w.day_of_week] : 'Any day'}</Td>
                <Td>{w.exercise_count} exercises</Td>
                <Td>{w.is_active ? <span className="text-xs text-success">Active</span> : <span className="text-xs text-text-secondary">Inactive</span>}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(w)} className="text-xs font-medium text-text-secondary hover:text-text-primary bg-transparent border-0 cursor-pointer">Edit</button>
                    <button onClick={() => setDeleteTarget(w)} className="text-xs font-medium text-error bg-transparent border-0 cursor-pointer">Delete</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setSlideOverOpen(false) }}
        title={editing ? 'Edit Workout Plan' : 'New Workout Plan'}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setAssignDialogOpen(true)}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border border-[var(--border)] rounded-md px-3 py-2 cursor-pointer whitespace-nowrap"
            >
              Assigned Users ({assignedUserIds.length})
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
              <Button onClick={() => saveWorkout.mutate()} loading={saveWorkout.isPending} disabled={!form.name}>
                {editing ? 'Save changes' : 'Create plan'}
              </Button>
            </div>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Plan name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Push/Pull/Legs" required />

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Day of week</label>
            <select
              className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none"
              value={form.day_of_week ?? ''}
              onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value === '' ? null : Number(e.target.value) }))}
            >
              <option value="">Any day</option>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>

          <Input label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes for the user" />

          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>

          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Exercises</p>
            {exercises.map((ex, i) => (
              <div key={i} className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 mb-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Exercise name</label>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <ExerciseCombobox
                          value={ex.name}
                          onChange={(name, muscleGroup, exerciseId) => updateExerciseName(i, name, muscleGroup, exerciseId)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSlideOverOpen(true)}
                        className="flex-shrink-0 text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border border-[var(--border)] rounded-md px-2 py-2 whitespace-nowrap cursor-pointer"
                        title="Browse exercise database"
                      >
                        ⊞ Browse
                      </button>
                    </div>
                  </div>
                  <Input label="Muscle group" value={ex.muscle_group ?? ''} onChange={e => updateExercise(i, 'muscle_group', e.target.value)} placeholder="e.g. Chest" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Input label="Sets" type="number" value={String(ex.sets)} onChange={e => updateExercise(i, 'sets', Number(e.target.value))} />
                  <Input label="Reps" value={ex.reps} onChange={e => updateExercise(i, 'reps', e.target.value)} placeholder="e.g. 10 or 8-12" />
                  <Input label="Rest (sec)" type="number" value={String(ex.rest_seconds)} onChange={e => updateExercise(i, 'rest_seconds', Number(e.target.value))} />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><Input label="Tips" value={ex.tips ?? ''} onChange={e => updateExercise(i, 'tips', e.target.value)} placeholder="Optional coaching tips" /></div>
                  <button onClick={() => removeExercise(i)} className="text-xs text-red-400 hover:text-red-300 bg-transparent border-0 cursor-pointer pb-2">Remove</button>
                </div>
              </div>
            ))}
            <button
              onClick={() => setExercises(ex => [...ex, { ...blankExercise(), sort_order: ex.length }])}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer"
            >
              + Add exercise
            </button>
          </div>
        </div>
      </Modal>

      <ExerciseBrowserSlideOver
        open={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        addedNames={exercises.map(e => e.name)}
        onAdd={(name, muscleGroup, exerciseId) =>
          setExercises(ex => [...ex, { ...blankExercise(), exercise_id: exerciseId || null, name, muscle_group: muscleGroup, sort_order: ex.length }])
        }
      />

      <AssignUsersDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        profiles={profiles}
        value={assignedUserIds}
        onChange={setAssignedUserIds}
      />

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
