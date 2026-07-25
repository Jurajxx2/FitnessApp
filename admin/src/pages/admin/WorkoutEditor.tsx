import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, Plus, Users } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AssignUsersDialog } from '../../components/AssignUsersDialog'
import { ExerciseBrowserSlideOver } from '../../components/ExerciseBrowserSlideOver'
import { LogTypeToggle } from '../../components/LogTypeToggle'
import { SelectedExerciseCard } from '../../components/SelectedExerciseCard'
import { WorkoutDurationControl } from '../../components/WorkoutDurationControl'
import { Button, Card, EditorPage, EmptyState, FormSection, Input, Shimmer, useNotice } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { appendUserContext, getUserContextReturn } from '../../lib/adminUserContext'
import type { Profile, Workout } from '../../types/database'
import { applyLogTypeChange, clampTargetDuration, DEFAULT_TIME_TARGET_SECONDS, estimateWorkoutDuration, inferWorkoutExerciseLogType, moveItem, type WorkoutDurationMode } from '../../workouts/builder'
import { blankExercise, describeInvalidExerciseRows, findBlankNamedExerciseRows, type ExerciseDraft } from './Workouts'

interface WorkoutFormState {
  name: string
  notes: string
  is_active: boolean
  day_of_week: string
  duration_mode: WorkoutDurationMode
  duration_minutes: string
}

const blankForm = (): WorkoutFormState => ({ name: '', notes: '', is_active: true, day_of_week: '', duration_mode: 'auto', duration_minutes: '45' })

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
        supabase.from('workout_exercises').select('*, exercise:exercises!workout_exercises_exercise_id_fkey(id, image_url, image_url_2)').eq('workout_id', id!).order('sort_order'),
        supabase.from('user_workouts').select('user_id').eq('workout_id', id!),
      ])
      if (workoutResult.error) throw workoutResult.error
      if (exerciseResult.error) throw exerciseResult.error
      if (assignmentResult.error) throw assignmentResult.error
      return {
        workout: workoutResult.data as Workout,
        exercises: (exerciseResult.data ?? []).map(exercise => {
          const visual = exercise.exercise as { image_url: string | null; image_url_2: string | null } | null
          return {
            client_id: exercise.id,
            exercise_id: exercise.exercise_id ?? null,
            name: exercise.name,
            muscle_group: exercise.muscle_group ?? '',
            sets: exercise.sets,
            reps: exercise.reps,
            log_type: exercise.log_type ?? inferWorkoutExerciseLogType(exercise.name, exercise.reps),
            target_duration_seconds: exercise.target_duration_seconds ?? null,
            rest_seconds: exercise.rest_seconds,
            tips: exercise.tips ?? '',
            sort_order: exercise.sort_order,
            image_url: visual?.image_url ?? null,
            image_url_2: visual?.image_url_2 ?? null,
          }
        }) as ExerciseDraft[],
        assignedUserIds: (assignmentResult.data ?? []).map(row => row.user_id),
      }
    },
  })
}

export default function WorkoutEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialUserId = searchParams.get('user')
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const { data, isLoading, isError, error } = useWorkoutEditorData(id)
  const { data: profiles = [] } = useProfiles()
  const [form, setForm] = useState<WorkoutFormState>(blankForm())
  const [exercises, setExercises] = useState<ExerciseDraft[]>([])
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [exerciseBrowserOpen, setExerciseBrowserOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.workout.name,
      notes: data.workout.notes ?? '',
      is_active: data.workout.is_active,
      day_of_week: data.workout.day_of_week == null ? '' : String(data.workout.day_of_week),
      duration_mode: data.workout.duration_mode ?? 'auto',
      duration_minutes: String(data.workout.duration_minutes || 45),
    })
    setExercises(data.exercises)
    setAssignedUserIds(data.assignedUserIds)
  }, [data])

  useEffect(() => {
    if (isNew && initialUserId) setAssignedUserIds([initialUserId])
  }, [initialUserId, isNew])

  const saveWorkout = useMutation({
    mutationFn: async () => {
      const invalidRows = findBlankNamedExerciseRows(exercises)
      if (invalidRows.length) throw new Error(describeInvalidExerciseRows(invalidRows))

      const validExercises = exercises.filter(exercise => exercise.name.trim())
      if (!validExercises.length) throw new Error('Add at least one exercise before saving.')
      const automaticDuration = estimateWorkoutDuration(validExercises)
      const manualDuration = Number(form.duration_minutes)
      const durationMinutes = form.duration_mode === 'auto' ? automaticDuration : manualDuration
      if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 360) throw new Error('Estimated duration must be between 5 and 360 minutes.')
      const { data: workoutId, error: saveError } = await supabase.rpc('admin_save_workout_v3', {
        p_workout_id: id ?? null,
        p_name: form.name,
        p_day_of_week: form.day_of_week === '' ? null : Number(form.day_of_week),
        p_notes: form.notes,
        p_is_active: form.is_active,
        p_duration_minutes: durationMinutes,
        p_duration_mode: form.duration_mode,
        p_exercises: validExercises.map((exercise, index) => ({
          exercise_id: exercise.exercise_id,
          name: exercise.name,
          muscle_group: exercise.muscle_group,
          sets: exercise.sets,
          reps: exercise.reps,
          log_type: exercise.log_type,
          target_duration_seconds: exercise.target_duration_seconds,
          rest_seconds: exercise.rest_seconds,
          tips: exercise.tips,
          sort_order: index,
        })),
        p_assigned_user_ids: assignedUserIds,
      })
      if (saveError) throw saveError
      return workoutId as string
    },
    onSuccess: workoutId => {
      queryClient.invalidateQueries({ queryKey: ['workouts-admin'] })
      queryClient.invalidateQueries({ queryKey: ['workout-admin', workoutId] })
      notify(isNew ? 'Workout plan created.' : 'Workout plan saved.')
      if (isNew) {
        navigate(appendUserContext(`/admin/workouts/${workoutId}`, initialUserId), { replace: true })
      }
    },
    onError: mutationError => notify(`Couldn’t save workout plan: ${mutationError.message}`, 'error'),
  })

  function updateExercise(index: number, field: keyof ExerciseDraft, value: string | number) {
    setExercises(current => current.map((exercise, currentIndex) => currentIndex === index ? { ...exercise, [field]: value } : exercise))
  }

  function moveExercise(fromIndex: number, toIndex: number) {
    setExercises(current => moveItem(current, fromIndex, toIndex))
  }

  function dropExercise(fromClientId: string, toIndex: number) {
    setExercises(current => moveItem(current, current.findIndex(exercise => exercise.client_id === fromClientId), toIndex))
  }

  const targetUser = profiles.find(profile => profile.id === initialUserId)
  const { to: returnTo, label: returnLabel } = getUserContextReturn(initialUserId, targetUser, '/admin/workouts', 'Back to workouts')
  const summaryDuration = form.duration_mode === 'auto' ? estimateWorkoutDuration(exercises) : Number(form.duration_minutes)

  if (!isNew && isLoading) {
    return <EditorPage backTo={returnTo} backLabel={returnLabel} eyebrow="Workout plan" title="Loading plan…"><Shimmer className="h-96 w-full" /></EditorPage>
  }

  if (!isNew && (isError || !data)) {
    return (
      <EditorPage backTo={returnTo} backLabel={returnLabel} eyebrow="Workout plan" title="Plan unavailable">
        <EmptyState title="This workout plan couldn’t be loaded" description={error?.message ?? 'It may have been deleted.'} />
      </EditorPage>
    )
  }

  return (
    <EditorPage
      backTo={returnTo}
      backLabel={returnLabel}
      eyebrow="Workout plan"
      title={isNew ? 'Create workout plan' : form.name || 'Edit workout plan'}
      description="Define the training sequence, coaching notes, and user assignments. Athletes can train the plan whenever it fits their schedule."
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate(returnTo)}>Cancel</Button>
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
              <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Estimated time</span><span className="font-semibold text-text-primary">{summaryDuration > 0 ? `~${summaryDuration} min` : '—'}</span></div>
              <div className="flex justify-between gap-3 py-2"><span className="text-text-secondary">Visibility</span><span className="font-semibold text-text-primary">{form.is_active ? 'Active' : 'Inactive'}</span></div>
            </div>
          </Card>
          <Card>
            <Users size={19} className="text-accent" aria-hidden="true" />
            <h2 className="mt-3 font-bold text-text-primary">User assignments</h2>
            <p className="mt-2 text-sm leading-5 text-text-secondary">{assignedUserIds.length} user{assignedUserIds.length === 1 ? '' : 's'} assigned to this plan.</p>
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
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Preferred day</label>
            <select
              className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary"
              value={form.day_of_week}
              onChange={event => setForm(current => ({ ...current, day_of_week: event.target.value }))}
            >
              <option value="">Any day (flexible)</option>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => (
                <option key={day} value={index}>{day}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-secondary">Flexible workouts appear as a weekly checklist the athlete can do any day.</p>
          </div>
          <div className="sm:col-span-2">
            <Input label="Notes" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Optional instructions visible to the athlete" />
          </div>
        </div>
        <div className="mt-4">
          <WorkoutDurationControl
            locale="en"
            exercises={exercises}
            mode={form.duration_mode}
            manualMinutes={form.duration_minutes}
            onModeChange={duration_mode => setForm(current => ({ ...current, duration_mode }))}
            onManualMinutesChange={duration_minutes => setForm(current => ({ ...current, duration_minutes }))}
          />
        </div>
      </FormSection>

      <FormSection title="Exercises" description="Add exercises from the library, then drag them or use the arrow controls to set execution order.">
        <div className="space-y-4">
          {exercises.map((exercise, index) => (
            <SelectedExerciseCard
              key={exercise.client_id}
              clientId={exercise.client_id}
              name={exercise.name}
              subtitle={exercise.muscle_group}
              imageUrl={exercise.image_url}
              imageUrl2={exercise.image_url_2}
              index={index}
              total={exercises.length}
              locale="en"
              detailHref={exercise.exercise_id ? `/admin/exercises/${exercise.exercise_id}` : null}
              onMove={toIndex => moveExercise(index, toIndex)}
              onDropExercise={dropExercise}
              onRemove={() => setExercises(current => current.filter(item => item.client_id !== exercise.client_id))}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Exercise name" value={exercise.name} onChange={event => updateExercise(index, 'name', event.target.value)} placeholder="e.g. Bench Press" required />
                <Input label="Muscle group" value={exercise.muscle_group ?? ''} onChange={event => updateExercise(index, 'muscle_group', event.target.value)} placeholder="e.g. Chest" />
              </div>
              <fieldset className="mt-4 rounded-2xl border border-outline-subtle bg-surface p-3">
                <legend className="px-1 text-xs font-bold uppercase tracking-wider text-text-secondary">Tracking</legend>
                <LogTypeToggle
                  locale="en"
                  value={exercise.log_type ?? 'weight_reps'}
                  onChange={next => setExercises(prev => prev.map((e, i) => i === index ? applyLogTypeChange(e, next) : e))}
                />
              </fieldset>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Input label="Sets" type="number" min="0" value={String(exercise.sets)} onChange={event => updateExercise(index, 'sets', Number(event.target.value))} />
                {exercise.log_type === 'time'
                  ? <Input label="Duration (sec)" type="number" min="1" max="3600" value={String(exercise.target_duration_seconds ?? DEFAULT_TIME_TARGET_SECONDS)} onChange={event => {
                      // Clamp to [1,3600]; keep the last valid value on empty/invalid input so
                      // clearing the field never persists a 0-second time target (fails the DB CHECK).
                      const parsed = Number(event.target.value)
                      updateExercise(index, 'target_duration_seconds', parsed >= 1 ? clampTargetDuration(parsed) : (exercise.target_duration_seconds ?? DEFAULT_TIME_TARGET_SECONDS))
                    }} />
                  : <Input label="Reps" value={exercise.reps} onChange={event => updateExercise(index, 'reps', event.target.value)} placeholder="10 or 8–12" />}
                <Input label="Rest (sec)" type="number" min="0" value={String(exercise.rest_seconds)} onChange={event => updateExercise(index, 'rest_seconds', Number(event.target.value))} />
              </div>
              <div className="mt-4">
                <Input label="Coaching tips" value={exercise.tips ?? ''} onChange={event => updateExercise(index, 'tips', event.target.value)} placeholder="Optional technique cue" />
              </div>
            </SelectedExerciseCard>
          ))}
          {!exercises.length && <p className="rounded-2xl border border-dashed border-outline p-6 text-sm text-text-secondary">No exercises selected yet.</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setExerciseBrowserOpen(true)}><Plus size={16} /> Browse exercise library</Button>
            <Button variant="ghost" onClick={() => setExercises(current => [...current, { ...blankExercise(), sort_order: current.length }])}>Add custom exercise</Button>
          </div>
        </div>
      </FormSection>

      {saveWorkout.error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{saveWorkout.error.message}</p>}

      <ExerciseBrowserSlideOver
        open={exerciseBrowserOpen}
        onClose={() => setExerciseBrowserOpen(false)}
        selectedIds={exercises.flatMap(exercise => exercise.exercise_id ? [exercise.exercise_id] : [])}
        onAdd={exercise => setExercises(current => [...current, {
          ...blankExercise(),
          exercise_id: exercise.id,
          name: exercise.name_en,
          muscle_group: exercise.primary_muscles[0] ?? '',
          sort_order: current.length,
          image_url: exercise.image_url,
          image_url_2: exercise.image_url_2,
          log_type: inferWorkoutExerciseLogType(exercise.name_en),
          target_duration_seconds: inferWorkoutExerciseLogType(exercise.name_en) === 'time' ? 30 : null,
        }])}
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
