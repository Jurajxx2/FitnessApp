import { LOG_TYPE_OPTIONS } from '../workouts/builder'
import type { WorkoutExerciseLogType } from '../workouts/builder'

interface LogTypeToggleProps {
  value: WorkoutExerciseLogType
  onChange: (value: WorkoutExerciseLogType) => void
  locale: 'en' | 'sk'
  disabled?: boolean
}

export function LogTypeToggle({ value, onChange, locale, disabled }: LogTypeToggleProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {LOG_TYPE_OPTIONS.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => !active && onChange(option.value)}
            className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-semibold disabled:cursor-default disabled:opacity-40 ${active ? 'border-transparent bg-accent text-on-accent' : 'border-outline bg-surface text-text-secondary'}`}
          >
            {option.label[locale]}
          </button>
        )
      })}
    </div>
  )
}
