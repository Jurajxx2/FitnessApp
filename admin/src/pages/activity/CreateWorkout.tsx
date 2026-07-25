import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createUserWorkout } from '../../activity/api'
import type { UserWorkoutExerciseDraft } from '../../activity/types'
import { ExercisePicker, type ExercisePickerItem } from '../../components/ExercisePicker'
import { LogTypeToggle } from '../../components/LogTypeToggle'
import { SelectedExerciseCard } from '../../components/SelectedExerciseCard'
import { WorkoutDurationControl } from '../../components/WorkoutDurationControl'
import { useNotice } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { applyLogTypeChange, createExerciseDraftId, estimateWorkoutDuration, inferWorkoutExerciseLogType, moveItem, type WorkoutDurationMode } from '../../workouts/builder'
import { ActivityPage, PageIntro } from './shared'

const DEFAULT_EXERCISE = { sets: 3, reps: '10', rest_seconds: 60 }

function asPositiveInteger(value: string, fallback: number, max: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback
}

function makeDraft(exercise: ExercisePickerItem): UserWorkoutExerciseDraft {
  const name = exercise.name_cs || exercise.name_en
  const logType = inferWorkoutExerciseLogType(name)
  return {
    client_id: createExerciseDraftId(),
    exercise_id: exercise.id,
    name,
    muscle_group: exercise.primary_muscles[0] ?? null,
    image_url: exercise.image_url,
    image_url_2: exercise.image_url_2,
    ...DEFAULT_EXERCISE,
    log_type: logType,
    target_duration_seconds: logType === 'time' ? 30 : null,
  }
}

export default function CreateWorkout() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [durationMode, setDurationMode] = useState<WorkoutDurationMode>('auto')
  const [manualDuration, setManualDuration] = useState('45')
  const [selected, setSelected] = useState<UserWorkoutExerciseDraft[]>([])
  const saveMutation = useMutation({
    mutationFn: () => {
      const trimmedName = name.trim()
      if (!trimmedName) throw new Error('Pomenuj svoj tréning.')
      if (!selected.length) throw new Error('Pridaj aspoň jeden cvik.')
      const durationMinutes = durationMode === 'auto'
        ? estimateWorkoutDuration(selected)
        : asPositiveInteger(manualDuration, 0, 360)
      if (durationMinutes < 5) throw new Error('Odhad trvania musí byť od 5 do 360 minút.')
      return createUserWorkout(userId, {
        name: trimmedName,
        notes: notes.trim() || null,
        duration_minutes: durationMinutes,
        duration_mode: durationMode,
        exercises: selected,
      })
    },
    onSuccess: async workout => {
      await queryClient.invalidateQueries({ queryKey: ['activity', 'assigned', userId] })
      notify('Vlastný tréning je pripravený.')
      navigate(`/activity/workouts/${workout.id}`, { replace: true })
    },
  })

  function addExercise(exercise: ExercisePickerItem) {
    setSelected(current => current.some(item => item.exercise_id === exercise.id) ? current : [...current, makeDraft(exercise)])
  }

  function updateExercise(index: number, field: 'sets' | 'reps' | 'rest_seconds' | 'target_duration_seconds', value: string) {
    setSelected(current => current.map((exercise, currentIndex) => {
      if (currentIndex !== index) return exercise
      if (field === 'reps') return { ...exercise, reps: value }
      if (field === 'target_duration_seconds') return { ...exercise, target_duration_seconds: asPositiveInteger(value, exercise.target_duration_seconds ?? 30, 3_600) }
      return { ...exercise, [field]: asPositiveInteger(value, exercise[field], field === 'sets' ? 20 : 900) }
    }))
  }

  function moveExercise(fromIndex: number, toIndex: number) {
    setSelected(current => moveItem(current, fromIndex, toIndex))
  }

  function dropExercise(fromClientId: string, toIndex: number) {
    setSelected(current => moveItem(current, current.findIndex(exercise => exercise.client_id === fromClientId), toIndex))
  }

  return (
    <ActivityPage>
      <PageIntro eyebrow="Môj tréning" title="Vytvoriť vlastný tréning" description="Vyber si cviky, nastav série a opakovania. Tréning zostane len v tvojom účte a môžeš ho spustiť kedykoľvek." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
        <section className="space-y-5 rounded-2xl border border-outline bg-surface-elevated p-5 sm:p-6">
          <Field label="Názov tréningu" value={name} onChange={setName} placeholder="Napr. Môj push tréning" required />
          <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
            Poznámka (voliteľné)
            <textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} placeholder="Čo chceš dnes odcvičiť?" className="mt-2 w-full resize-y rounded-xl border border-outline bg-surface p-3 text-sm font-normal normal-case tracking-normal text-text-primary outline-none focus:border-accent" />
          </label>
          <WorkoutDurationControl
            locale="sk"
            exercises={selected}
            mode={durationMode}
            manualMinutes={manualDuration}
            onModeChange={setDurationMode}
            onManualMinutesChange={setManualDuration}
          />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">Vybrané cviky</h3>
            {selected.length ? (
              <div className="mt-3 space-y-3">
                {selected.map((exercise, index) => (
                  <SelectedExerciseCard
                    key={exercise.client_id}
                    clientId={exercise.client_id}
                    name={exercise.name}
                    subtitle={exercise.muscle_group}
                    imageUrl={exercise.image_url}
                    imageUrl2={exercise.image_url_2}
                    index={index}
                    total={selected.length}
                    locale="sk"
                    detailHref={`/activity/exercises/${exercise.exercise_id}`}
                    onMove={toIndex => moveExercise(index, toIndex)}
                    onDropExercise={dropExercise}
                    onRemove={() => setSelected(current => current.filter(item => item.client_id !== exercise.client_id))}
                  >
                    <fieldset className="mb-3 rounded-xl border border-outline-subtle bg-surface p-3">
                      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-text-secondary">Sledovanie</legend>
                      <LogTypeToggle
                        locale="sk"
                        value={exercise.log_type ?? 'weight_reps'}
                        onChange={next => setSelected(current => current.map((item, currentIndex) => currentIndex === index ? applyLogTypeChange(item, next) : item))}
                      />
                    </fieldset>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Série" value={String(exercise.sets)} onChange={value => updateExercise(index, 'sets', value)} type="number" min="1" max="20" />
                      {exercise.log_type === 'time'
                        ? <Field label="Trvanie (s)" value={String(exercise.target_duration_seconds ?? 30)} onChange={value => updateExercise(index, 'target_duration_seconds', value)} type="number" min="1" max="3600" />
                        : <Field label="Opakovania" value={exercise.reps} onChange={value => updateExercise(index, 'reps', value)} placeholder="10" />}
                      <Field label="Pauza (s)" value={String(exercise.rest_seconds)} onChange={value => updateExercise(index, 'rest_seconds', value)} type="number" min="1" max="900" />
                    </div>
                  </SelectedExerciseCard>
                ))}
              </div>
            ) : <p className="mt-3 rounded-xl border border-dashed border-outline p-5 text-sm text-text-secondary">Vyber cvik z knižnice vpravo.</p>}
          </div>
          {saveMutation.isError && <p role="alert" className="text-sm text-error">{saveMutation.error.message}</p>}
          <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-action-primary px-5 text-sm font-bold text-on-action-primary disabled:opacity-40">
            {saveMutation.isPending ? 'Ukladá sa…' : 'Uložiť vlastný tréning'}
          </button>
        </section>
        <section className="rounded-2xl border border-outline bg-surface-elevated p-5 sm:p-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">Pridať cvik</h3>
          <p className="mt-1 text-sm text-text-secondary">Filtruj knižnicu a pridaj cviky do tréningu.</p>
          <div className="mt-4">
            <ExercisePicker locale="sk" selectedIds={selected.map(exercise => exercise.exercise_id)} onAdd={addExercise} />
          </div>
        </section>
      </div>
    </ActivityPage>
  )
}

function Field({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">{label}<input {...props} value={value} onChange={event => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-outline bg-surface px-3 text-sm font-normal normal-case tracking-normal text-text-primary outline-none focus:border-accent" /></label>
}
