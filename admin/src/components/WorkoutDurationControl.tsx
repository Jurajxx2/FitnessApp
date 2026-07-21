import type { DurationExercise, WorkoutDurationMode } from '../workouts/builder'
import { estimateWorkoutDuration } from '../workouts/builder'

interface WorkoutDurationControlProps {
  locale: 'en' | 'sk'
  exercises: DurationExercise[]
  mode: WorkoutDurationMode
  manualMinutes: string
  onModeChange: (mode: WorkoutDurationMode) => void
  onManualMinutesChange: (value: string) => void
}

export function WorkoutDurationControl({ locale, exercises, mode, manualMinutes, onModeChange, onManualMinutesChange }: WorkoutDurationControlProps) {
  const estimate = estimateWorkoutDuration(exercises)
  const copy = locale === 'sk'
    ? { title: 'Odhad trvania', auto: 'Automaticky', manual: 'Vlastný odhad', based: 'Podľa sérií, prestávok a presunov medzi cvikmi.', empty: 'Pridaj cviky a odhad sa vypočíta.', minutes: 'Minúty' }
    : { title: 'Estimated duration', auto: 'Automatic', manual: 'Custom estimate', based: 'Based on sets, rest periods, and transitions.', empty: 'Add exercises to calculate an estimate.', minutes: 'Minutes' }

  return (
    <fieldset className="rounded-2xl border border-outline-subtle bg-surface p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.title}</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={mode === 'auto'} onClick={() => onModeChange('auto')} className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-semibold ${mode === 'auto' ? 'border-transparent bg-accent text-on-accent' : 'border-outline bg-surface text-text-secondary'}`}>{copy.auto}</button>
        <button type="button" aria-pressed={mode === 'manual'} onClick={() => onModeChange('manual')} className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-semibold ${mode === 'manual' ? 'border-transparent bg-accent text-on-accent' : 'border-outline bg-surface text-text-secondary'}`}>{copy.manual}</button>
      </div>
      {mode === 'auto' ? (
        <div className="mt-3">
          <p className="text-2xl font-bold text-text-primary">{estimate > 0 ? `~${estimate} min` : '—'}</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{estimate > 0 ? copy.based : copy.empty}</p>
        </div>
      ) : (
        <label className="mt-3 block max-w-40 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {copy.minutes}
          <input type="number" min="5" max="360" required value={manualMinutes} onChange={event => onManualMinutesChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-outline bg-surface px-3 text-sm font-normal normal-case tracking-normal text-text-primary outline-none focus:border-accent" />
        </label>
      )}
    </fieldset>
  )
}
