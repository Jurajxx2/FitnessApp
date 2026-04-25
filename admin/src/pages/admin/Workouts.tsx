// admin/src/pages/admin/Workouts.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, Input, Modal, Table, Th, Td } from '../../components/ui'
import { ExerciseCombobox } from '../../components/ExerciseCombobox'
import { ExerciseBrowserSlideOver } from '../../components/ExerciseBrowserSlideOver'
import type { Workout, WorkoutExercise } from '../../types/database'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type WorkoutWithCount = Workout & { exercise_count: number }

function useWorkouts() {
  return useQuery<WorkoutWithCount[]>({
    queryKey: ['workouts-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('workouts')
        .select('*, workout_exercises(id)')
        .order('name')
      return (data ?? []).map(w => ({
        ...w,
        exercise_count: (w.workout_exercises as { id: string }[]).length,
      }))
    },
  })
}


type ExerciseDraft = Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at'>

const blankExercise = (): ExerciseDraft => ({
  name: '', muscle_group: '', sets: 3, reps: '10', rest_seconds: 60, tips: '', sort_order: 0,
})

interface WorkoutFormState {
  name: string
  day_of_week: number | null
  notes: string
  is_active: boolean
}

export default function Workouts() {
  const qc = useQueryClient()
  const { data: workouts = [], isLoading } = useWorkouts()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Workout | null>(null)
  const [form, setForm] = useState<WorkoutFormState>({ name: '', day_of_week: null, notes: '', is_active: true })
  const [exercises, setExercises] = useState<ExerciseDraft[]>([blankExercise()])
  const [slideOverOpen, setSlideOverOpen] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm({ name: '', day_of_week: null, notes: '', is_active: true })
    setExercises([blankExercise()])
    setEditorOpen(true)
  }

  async function openEdit(w: Workout) {
    setEditing(w)
    setForm({ name: w.name, day_of_week: w.day_of_week, notes: w.notes ?? '', is_active: w.is_active })
    const { data } = await supabase
      .from('workout_exercises')
      .select('*')
      .eq('workout_id', w.id)
      .order('sort_order')
    setExercises(data?.map(e => ({
      name: e.name, muscle_group: e.muscle_group ?? '', sets: e.sets, reps: e.reps,
      rest_seconds: e.rest_seconds, tips: e.tips ?? '', sort_order: e.sort_order,
    })) ?? [blankExercise()])
    setEditorOpen(true)
  }

  const saveWorkout = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error: updateErr } = await supabase.from('workouts').update({ ...form }).eq('id', editing.id)
        if (updateErr) throw updateErr
        const { error: deleteErr } = await supabase.from('workout_exercises').delete().eq('workout_id', editing.id)
        if (deleteErr) throw deleteErr
        if (exercises.length) {
          const { error: insertErr } = await supabase.from('workout_exercises').insert(
            exercises.map((e, i) => ({ ...e, workout_id: editing.id, sort_order: i }))
          )
          if (insertErr) throw insertErr
        }
      } else {
        const { data: w, error } = await supabase
          .from('workouts')
          .insert({ ...form })
          .select()
          .single()
        if (error) throw error
        if (exercises.length) {
          await supabase.from('workout_exercises').insert(
            exercises.map((e, i) => ({ ...e, workout_id: w.id, sort_order: i }))
          )
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts-admin'] })
      setEditorOpen(false)
      setSlideOverOpen(false)
    },
  })

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('workouts').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts-admin'] }),
  })

  function updateExercise(i: number, field: keyof ExerciseDraft, value: string | number) {
    setExercises(ex => ex.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  function updateExerciseName(i: number, name: string, muscleGroup: string) {
    setExercises(ex => ex.map((e, idx) =>
      idx === i ? { ...e, name, ...(muscleGroup ? { muscle_group: muscleGroup } : {}) } : e
    ))
  }

  function removeExercise(i: number) {
    setExercises(ex => ex.filter((_, idx) => idx !== i))
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-[var(--text)]">Workouts</h1>
        <Button onClick={openCreate}>+ Create plan</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
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
            {workouts.map(w => (
              <tr key={w.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td className="text-[var(--text)] font-semibold">{w.name}</Td>
                <Td>{w.day_of_week !== null ? DAYS[w.day_of_week] : 'Any day'}</Td>
                <Td>{w.exercise_count} exercises</Td>
                <Td>{w.is_active ? <span className="text-green-400 text-xs">Active</span> : <span className="text-[var(--text-disabled)] text-xs">Inactive</span>}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(w)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">Edit</button>
                    <button onClick={() => { if (confirm('Delete this workout?')) deleteWorkout.mutate(w.id) }} className="text-xs text-red-400 hover:text-red-300 bg-transparent border-0 cursor-pointer">Delete</button>
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
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveWorkout.mutate()} loading={saveWorkout.isPending} disabled={!form.name}>
              {editing ? 'Save changes' : 'Create plan'}
            </Button>
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
                          onChange={(name, muscleGroup) => updateExerciseName(i, name, muscleGroup)}
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
        onAdd={(name, muscleGroup) =>
          setExercises(ex => [...ex, { ...blankExercise(), name, muscle_group: muscleGroup, sort_order: ex.length }])
        }
      />
    </div>
  )
}
