import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, Users } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { AssignUsersDialog } from '../../components/AssignUsersDialog'
import { ExerciseBrowserSlideOver } from '../../components/ExerciseBrowserSlideOver'
import { ExerciseCombobox } from '../../components/ExerciseCombobox'
import { Button, Card, EditorPage, EmptyState, FormSection, Input, Shimmer, useNotice } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { Profile, Workout } from '../../types/database'
import { DAYS, blankExercise, describeInvalidExerciseRows, findBlankNamedExerciseRows, type ExerciseDraft } from './Workouts'

interface WorkoutFormState {
  name: string
  day_of_week: number | null
  notes: string
  is_active: boolean
}

const blankForm = (): WorkoutFormState => ({ name: '', day_of_week: null, notes: '', is_active: true })

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

function useWorkoutEditorData(id: string | undefined) {
  return useQuery({
    queryKey: ['workout-admin', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [workoutResult, exerciseResult, assignmentResult] = await Promise.all([
        supabase.from('workouts').select('*').eq('id', id!).eq('source', 'coach').single(),
        supabase.from('workout_exercises').select('*').eq('workout_id', id!).order('sort_order'),
        supabase.from('user_workouts').select('user_id').eq('workout_id', id!),
      ])
      if (workoutResult.error) throw workoutResult.error
      if (exerciseResult.error) throw exerciseResult.error
      if (assignmentResult.error) throw assignmentResult.error
      return {
        workout: workoutResult.data as Workout,
        exercises: (exerciseResult.data ?? []).map(exercise => ({
          exercise_id: exercise.exercise_id ?? null,
          name: exercise.name,
          muscle_group: exercise.muscle_group ?? '',
          sets: exercise.sets,
          reps: exercise.reps,
          rest_seconds: exercise.rest_seconds,
          tips: exercise.tips ?? '',
          sort_order: exercise.sort_order,
        })) as ExerciseDraft[],
        assignedUserIds: (assignmentResult.data ?? []).map(row => row.user_id),
      }
    },
  })
}

export default function WorkoutEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const { data, isLoading, isError, error } = useWorkoutEditorData(id)
  const { data: profiles = [] } = useProfiles()
  const [form, setForm] = useState<WorkoutFormState>(blankForm())
  const [exercises, setExercises] = useState<ExerciseDraft[]>([blankExercise()])
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [exerciseBrowserOpen, setExerciseBrowserOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.workout.name,
      day_of_week: data.workout.day_of_week,
      notes: data.workout.notes ?? '',
      is_active: data.workout.is_active,
    })
    setExercises(data.exercises.length > 0 ? data.exercises : [blankExercise()])
    setAssignedUserIds(data.assignedUserIds)
  }, [data])

  const saveWorkout = useMutation({
    mutationFn: async () => {
      const invalidRows = findBlankNamedExerciseRows(exercises)
      if (invalidRows.length) throw new Error(describeInvalidExerciseRows(invalidRows))

      const validExercises = exercises.filter(exercise => exercise.name.trim())
      const { data: workoutId, error: saveError } = await supabase.rpc('admin_save_workout', {
        p_workout_id: id ?? null,
        p_name: form.name,
        p_day_of_week: form.day_of_week,
        p_notes: form.notes,
        p_is_active: form.is_active,
        p_exercises: validExercises.map((exercise, index) => ({ ...exercise, sort_order: index })),
        p_assigned_user_ids: assignedUserIds,
      })
      if (saveError) throw saveError
      return workoutId as string
    },
    onSuccess: workoutId => {
      queryClient.invalidateQueries({ queryKey: ['workouts-admin'] })
      queryClient.invalidateQueries({ queryKey: ['workout-admin', workoutId] })
      notify(isNew ? 'Workout plan created.' : 'Workout plan saved.')
      if (isNew) navigate(`/admin/workouts/${workoutId}`, { replace: true })
    },
    onError: mutationError => notify(`Couldn’t save workout plan: ${mutationError.message}`, 'error'),
  })

  function updateExercise(index: number, field: keyof ExerciseDraft, value: string | number) {
    setExercises(current => current.map((exercise, currentIndex) => currentIndex === index ? { ...exercise, [field]: value } : exercise))
  }

  function updateExerciseName(index: number, name: string, muscleGroup: string, exerciseId: string) {
    setExercises(current => current.map((exercise, currentIndex) => currentIndex === index
      ? { ...exercise, name, exercise_id: exerciseId || null, ...(muscleGroup ? { muscle_group: muscleGroup } : {}) }
      : exercise
    ))
  }

  if (!isNew && isLoading) {
    return <EditorPage backTo="/admin/workouts" backLabel="Back to workouts" eyebrow="Workout plan" title="Loading plan…"><Shimmer className="h-96 w-full" /></EditorPage>
  }

  if (!isNew && (isError || !data)) {
    return (
      <EditorPage backTo="/admin/workouts" backLabel="Back to workouts" eyebrow="Workout plan" title="Plan unavailable">
        <EmptyState title="This workout plan couldn’t be loaded" description={error?.message ?? 'It may have been deleted.'} />
      </EditorPage>
    )
  }

  return (
    <EditorPage
      backTo="/admin/workouts"
      backLabel="Back to workouts"
      eyebrow="Workout plan"
      title={isNew ? 'Create workout plan' : form.name || 'Edit workout plan'}
      description="Define the training sequence, coaching notes, schedule, and athlete assignments in one workspace."
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate('/admin/workouts')}>Cancel</Button>
          <Button onClick={() => saveWorkout.mutate()} loading={saveWorkout.isPending} disabled={!form.name.trim()}>
            {isNew ? 'Create plan' : 'Save changes'}
          </Button>
        </>
      }
      aside={
        <>
          <Card>
            <Dumbbell size={19} className="text-accent" aria-hidden="true" />
            <h2 className="mt-3 font-bold text-text-primary">Plan summary</h2>
            <div className="mt-4 divide-y divide-outline-subtle text-sm">
              <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Exercises</span><span className="font-semibold text-text-primary">{exercises.filter(exercise => exercise.name.trim()).length}</span></div>
              <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Schedule</span><span className="font-semibold text-text-primary">{form.day_of_week === null ? 'Any day' : DAYS[form.day_of_week]}</span></div>
              <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Visibility</span><span className="font-semibold text-text-primary">{form.is_active ? 'Active' : 'Inactive'}</span></div>
            </div>
          </Card>
          <Card>
            <Users size={19} className="text-accent" aria-hidden="true" />
            <h2 className="mt-3 font-bold text-text-primary">Athlete assignments</h2>
            <p className="mt-2 text-sm leading-5 text-text-secondary">{assignedUserIds.length} athlete{assignedUserIds.length === 1 ? '' : 's'} assigned to this plan.</p>
            <Button variant="ghost" className="mt-4 w-full" onClick={() => setAssignDialogOpen(true)}>Manage assignments</Button>
          </Card>
          <Card>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1" checked={form.is_active} onChange={event => setForm(current => ({ ...current, is_active: event.target.checked }))} />
              <span>
                <span className="block text-sm font-semibold text-text-primary">Active plan</span>
                <span className="mt-1 block text-xs leading-5 text-text-secondary">Inactive plans stay in the admin library but are hidden from athlete plan lists.</span>
              </span>
            </label>
          </Card>
        </>
      }
    >
      <FormSection title="Plan details" description="Give coaches and athletes enough context to recognize the plan quickly.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Plan name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Push / Pull / Legs" required />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Day of week</label>
            <select
              className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent"
              value={form.day_of_week ?? ''}
              onChange={event => setForm(current => ({ ...current, day_of_week: event.target.value === '' ? null : Number(event.target.value) }))}
            >
              <option value="">Any day</option>
              {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Input label="Notes" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Optional instructions visible to the athlete" />
          </div>
        </div>
      </FormSection>

      <FormSection title="Exercises" description="Build the plan in execution order. Empty rows are ignored; partially completed rows must be fixed before saving.">
        <div className="space-y-4">
          {exercises.map((exercise, index) => (
            <article key={index} className="rounded-2xl border border-outline-subtle bg-surface p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Exercise {index + 1}</p>
                <button type="button" onClick={() => setExercises(current => current.filter((_, currentIndex) => currentIndex !== index))} className="min-h-9 cursor-pointer rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-error hover:bg-error/10">Remove</button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Exercise name</label>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <ExerciseCombobox value={exercise.name} onChange={(name, muscleGroup, exerciseId) => updateExerciseName(index, name, muscleGroup, exerciseId)} />
                    </div>
                    <Button variant="ghost" className="px-3" onClick={() => setExerciseBrowserOpen(true)}>Browse</Button>
                  </div>
                </div>
                <Input label="Muscle group" value={exercise.muscle_group ?? ''} onChange={event => updateExercise(index, 'muscle_group', event.target.value)} placeholder="e.g. Chest" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Input label="Sets" type="number" min="0" value={String(exercise.sets)} onChange={event => updateExercise(index, 'sets', Number(event.target.value))} />
                <Input label="Reps" value={exercise.reps} onChange={event => updateExercise(index, 'reps', event.target.value)} placeholder="10 or 8–12" />
                <Input label="Rest (sec)" type="number" min="0" value={String(exercise.rest_seconds)} onChange={event => updateExercise(index, 'rest_seconds', Number(event.target.value))} />
              </div>
              <div className="mt-4">
                <Input label="Coaching tips" value={exercise.tips ?? ''} onChange={event => updateExercise(index, 'tips', event.target.value)} placeholder="Optional technique cue" />
              </div>
            </article>
          ))}
          <Button variant="ghost" onClick={() => setExercises(current => [...current, { ...blankExercise(), sort_order: current.length }])}>Add exercise</Button>
        </div>
      </FormSection>

      {saveWorkout.error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{saveWorkout.error.message}</p>}

      <ExerciseBrowserSlideOver
        open={exerciseBrowserOpen}
        onClose={() => setExerciseBrowserOpen(false)}
        addedNames={exercises.map(exercise => exercise.name)}
        onAdd={(name, muscleGroup, exerciseId) => setExercises(current => [...current, { ...blankExercise(), exercise_id: exerciseId || null, name, muscle_group: muscleGroup, sort_order: current.length }])}
      />

      <AssignUsersDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        profiles={profiles}
        value={assignedUserIds}
        onChange={setAssignedUserIds}
      />
    </EditorPage>
  )
}
