import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createUserWorkout, getExercises } from '../../activity/api'
import type { ExerciseSummary, UserWorkoutExerciseDraft } from '../../activity/types'
import { useNotice } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { ActivityPage, ErrorBlock, LoadingBlock, PageIntro } from './shared'

const DEFAULT_EXERCISE = { sets: 3, reps: '10', rest_seconds: 60 }

function asPositiveInteger(value: string, fallback: number, max: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback
}

function makeDraft(exercise: ExerciseSummary): UserWorkoutExerciseDraft {
  return {
    exercise_id: exercise.id,
    name: exercise.name_cs || exercise.name_en,
    muscle_group: exercise.primary_muscles[0] ?? exercise.exercise_categories?.name ?? null,
    ...DEFAULT_EXERCISE,
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
  const [duration, setDuration] = useState('45')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<UserWorkoutExerciseDraft[]>([])
  const exercisesQuery = useQuery({
    queryKey: ['activity', 'exercises'],
    queryFn: getExercises,
    enabled: Boolean(userId),
  })
  const visibleExercises = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('sk-SK')
    if (!term) return (exercisesQuery.data ?? []).slice(0, 24)
    return (exercisesQuery.data ?? []).filter(exercise =>
      [exercise.name_en, exercise.name_cs, ...exercise.primary_muscles]
        .filter(Boolean)
        .some(value => value!.toLocaleLowerCase('sk-SK').includes(term))
    ).slice(0, 24)
  }, [exercisesQuery.data, search])
  const selectedIds = new Set(selected.map(exercise => exercise.exercise_id))
  const saveMutation = useMutation({
    mutationFn: () => {
      const trimmedName = name.trim()
      if (!trimmedName) throw new Error('Pomenuj svoj tréning.')
      if (!selected.length) throw new Error('Pridaj aspoň jeden cvik.')
      const durationMinutes = asPositiveInteger(duration, 45, 360)
      return createUserWorkout(userId, {
        name: trimmedName,
        notes: notes.trim() || null,
        duration_minutes: durationMinutes,
        exercises: selected,
      })
    },
    onSuccess: async workout => {
      await queryClient.invalidateQueries({ queryKey: ['activity', 'assigned', userId] })
      notify('Vlastný tréning je pripravený.')
      navigate(`/activity/workouts/${workout.id}`, { replace: true })
    },
  })

  function addExercise(exercise: ExerciseSummary) {
    setSelected(current => current.some(item => item.exercise_id === exercise.id) ? current : [...current, makeDraft(exercise)])
  }

  function updateExercise(index: number, field: 'sets' | 'reps' | 'rest_seconds', value: string) {
    setSelected(current => current.map((exercise, currentIndex) => {
      if (currentIndex !== index) return exercise
      if (field === 'reps') return { ...exercise, reps: value }
      return { ...exercise, [field]: asPositiveInteger(value, exercise[field], field === 'sets' ? 20 : 900) }
    }))
  }

  if (exercisesQuery.isLoading) return <ActivityPage><LoadingBlock label="Načítava sa knižnica cvikov…" /></ActivityPage>
  if (exercisesQuery.isError) return <ActivityPage><ErrorBlock message="Knižnicu cvikov sa nepodarilo načítať." /></ActivityPage>

  return (
    <ActivityPage>
      <PageIntro eyebrow="Môj tréning" title="Vytvoriť vlastný tréning" description="Vyber si cviky, nastav série a opakovania. Tréning zostane len v tvojom účte a môžeš ho spustiť kedykoľvek." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
        <section className="space-y-5 rounded-2xl border border-outline bg-surface-elevated p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field label="Názov tréningu" value={name} onChange={setName} placeholder="Napr. Môj push tréning" required />
            <Field label="Odhad trvania (min.)" value={duration} onChange={setDuration} type="number" min="5" max="360" required />
          </div>
          <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
            Poznámka (voliteľné)
            <textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} placeholder="Čo chceš dnes odcvičiť?" className="mt-2 w-full resize-y rounded-xl border border-outline bg-surface p-3 text-sm font-normal normal-case tracking-normal text-text-primary outline-none focus:border-accent" />
          </label>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-primary">Vybrané cviky</h3>
            {selected.length ? (
              <div className="mt-3 space-y-3">
                {selected.map((exercise, index) => (
                  <article key={exercise.exercise_id} className="rounded-xl border border-outline-subtle bg-surface p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-text-primary">{index + 1}. {exercise.name}</p>
                        {exercise.muscle_group && <p className="mt-1 text-xs text-text-secondary">{exercise.muscle_group}</p>}
                      </div>
                      <button type="button" onClick={() => setSelected(current => current.filter(item => item.exercise_id !== exercise.exercise_id))} aria-label={`Odstrániť ${exercise.name}`} className="cursor-pointer rounded-lg border-0 bg-transparent p-2 text-text-secondary hover:bg-error/10 hover:text-error"><Trash2 size={16} /></button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Field label="Série" value={String(exercise.sets)} onChange={value => updateExercise(index, 'sets', value)} type="number" min="1" max="20" />
                      <Field label="Opakovania" value={exercise.reps} onChange={value => updateExercise(index, 'reps', value)} placeholder="10" />
                      <Field label="Pauza (s)" value={String(exercise.rest_seconds)} onChange={value => updateExercise(index, 'rest_seconds', value)} type="number" min="1" max="900" />
                    </div>
                  </article>
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
          <label className="relative mt-3 block">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <span className="sr-only">Hľadať cviky</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Hľadať cvik alebo sval…" className="h-11 w-full rounded-xl border border-outline bg-surface pl-10 pr-3 text-sm text-text-primary outline-none focus:border-accent" />
          </label>
          <div className="mt-3 max-h-[34rem] space-y-2 overflow-y-auto pr-1">
            {visibleExercises.map(exercise => {
              const added = selectedIds.has(exercise.id)
              const title = exercise.name_cs || exercise.name_en
              return (
                <button key={exercise.id} type="button" disabled={added} onClick={() => addExercise(exercise)} className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-outline-subtle bg-surface p-3 text-left transition-colors hover:bg-surface-highest disabled:cursor-default disabled:opacity-55">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-highest text-text-primary">{added ? <Minus size={16} /> : <Plus size={16} />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text-primary">{title}</span><span className="mt-0.5 block truncate text-xs text-text-secondary">{exercise.primary_muscles.join(' · ') || exercise.exercise_categories?.name || 'Cvik'}</span></span>
                </button>
              )
            })}
            {!visibleExercises.length && <p className="rounded-xl border border-dashed border-outline p-5 text-sm text-text-secondary">Žiadne cviky nezodpovedajú vyhľadávaniu.</p>}
          </div>
        </section>
      </div>
    </ActivityPage>
  )
}

function Field({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">{label}<input {...props} value={value} onChange={event => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-outline bg-surface px-3 text-sm font-normal normal-case tracking-normal text-text-primary outline-none focus:border-accent" /></label>
}
