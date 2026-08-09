import type { ReactNode } from 'react'
import { ArrowRight, Bike, Dumbbell, Footprints, PersonStanding, Play, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDuration } from '../../activity/logic'
import type { ActivityType, ExerciseSummary, WorkoutRow } from '../../activity/types'

const DAY_NAMES_SK = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota', 'Nedeľa']

// Shared between LogActivity's create/edit form and History's general-activity rows so
// both surfaces label and iconify activity types identically.
export const ACTIVITY_TYPE_OPTIONS: Array<{ value: ActivityType; label: string }> = [
  { value: 'WALKING', label: 'Chôdza' },
  { value: 'RUNNING', label: 'Beh' },
  { value: 'CYCLING', label: 'Bicykel' },
  { value: 'YOGA', label: 'Joga' },
  { value: 'SWIMMING', label: 'Plávanie' },
  { value: 'OTHER', label: 'Iné' },
]

export function ActivityTypeIcon({ type, size = 18 }: { type: ActivityType; size?: number }) {
  if (type === 'CYCLING') return <Bike size={size} />
  if (type === 'SWIMMING') return <Waves size={size} />
  if (type === 'YOGA') return <PersonStanding size={size} />
  return <Footprints size={size} />
}

export function ActivityPage({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
}

export function PageIntro({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="flex items-center gap-2 ledger-label text-text-secondary">
            <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-2xl font-display font-bold tracking-tight text-text-primary sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function LoadingBlock({ label = 'Načítava sa aktivita…' }: { label?: string }) {
  return <div className="rounded-2xl border border-outline bg-surface-elevated p-8 text-sm text-text-secondary">{label}</div>
}

export function ErrorBlock({ message = 'Aktivitu sa nepodarilo načítať. Obnov stránku a skús to znova.' }: { message?: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-error/40 bg-error/10 p-5 text-sm text-error">
      {message}
    </div>
  )
}

export function SectionTitle({ title, action, description }: { title: string; action?: ReactNode; description?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2.5 font-display text-lg font-bold text-text-primary">
          <span className="h-4 w-1 shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
          {title}
        </h3>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ExerciseVisual({ exercise, name, className = '' }: { exercise?: ExerciseSummary | null; name: string; className?: string }) {
  const src = exercise?.image_url ?? exercise?.image_url_2
  if (src) return <img src={src} alt="" className={`object-cover ${className}`} loading="lazy" />
  return (
    <div className={`flex items-center justify-center bg-surface-highest text-text-secondary ${className}`} aria-hidden="true">
      <Dumbbell size={24} />
      <span className="sr-only">{name}</span>
    </div>
  )
}

export function WorkoutCard({ workout, compact = false }: { workout: WorkoutRow; compact?: boolean }) {
  const muscles = [...new Set(workout.workout_exercises.map(item => item.muscle_group).filter(Boolean))].slice(0, 3)
  return (
    <Link to={`/activity/workouts/${workout.id}`} className="group flex h-full flex-col rounded-2xl border border-outline bg-surface-elevated p-5 text-inherit no-underline transition-colors hover:bg-surface-highest">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-text-accent">{workout.day_of_week == null ? 'Ľubovoľný deň' : DAY_NAMES_SK[workout.day_of_week]}</p>
          <h4 className="mt-1 text-lg font-bold text-text-primary">{workout.name}</h4>
        </div>
        <ArrowRight size={18} className="mt-1 text-text-secondary transition-transform group-hover:translate-x-1" />
      </div>
      {!compact && workout.notes && <p className="mt-3 line-clamp-2 text-sm leading-6 text-text-secondary">{workout.notes}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-4 text-xs text-text-secondary">
        <span>~{formatDuration(workout.duration_minutes || 0)}</span>
        <span aria-hidden="true">·</span>
        <span>{workout.workout_exercises.length} cvikov</span>
      </div>
      {muscles.length > 0 && <p className="mt-2 truncate ledger-label text-text-secondary">{muscles.join(' · ')}</p>}
    </Link>
  )
}

export function StartButton({ pending, onClick, label = 'Začni trénovať' }: { pending: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={pending} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-action-primary px-5 text-sm font-bold text-on-action-primary transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50">
      <Play size={17} fill="currentColor" /> {pending ? 'Otvára sa…' : label}
    </button>
  )
}
