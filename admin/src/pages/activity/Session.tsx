import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronUp, CircleStop, Pause, Play, Plus, Save, TimerReset, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { addSet, discardWorkout, finishWorkout, getActiveWorkout, getWorkout, removeSet, saveSet } from '../../activity/api'
import type { ExerciseLogRow, SetLogRow, WorkoutExerciseRow, WorkoutLogRow } from '../../activity/types'
import { useAuth } from '../../hooks/useAuth'
import { formatSeconds } from '../../workouts/builder'
import { ActivityPage, ErrorBlock, LoadingBlock, PageIntro } from './shared'

interface SetDraft {
  reps: string
  weight: string
  duration: string
  rpe: string
}

function draftFromSet(set: SetLogRow): SetDraft {
  return {
    reps: set.actual_reps?.toString() ?? '',
    weight: set.actual_weight_kg?.toString() ?? '',
    duration: set.actual_duration_seconds?.toString() ?? '',
    rpe: set.rpe?.toString() ?? ''
  }
}

function nullableNumber(value: string) {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export default function WorkoutSession() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState('')
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [restRemaining, setRestRemaining] = useState(0)
  const activeQuery = useQuery({
    queryKey: ['activity', 'active', userId],
    queryFn: () => getActiveWorkout(userId),
    enabled: Boolean(userId),
    refetchOnWindowFocus: false
  })
  const workoutQuery = useQuery({
    queryKey: ['activity', 'workout', activeQuery.data?.workout_id],
    queryFn: () => getWorkout(activeQuery.data!.workout_id!),
    enabled: Boolean(activeQuery.data?.workout_id)
  })

  useEffect(() => {
    if (!restUntil) return
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000))
      setRestRemaining(remaining)
      if (!remaining) setRestUntil(null)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [restUntil])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['activity', 'active', userId] })
  const finishMutation = useMutation({
    mutationFn: (log: WorkoutLogRow) => finishWorkout(log, notes.trim() || null),
    onSuccess: async (_duration, log) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['activity', 'active', userId]
        }),
        queryClient.invalidateQueries({
          queryKey: ['activity', 'history', userId]
        })
      ])
      navigate(`/activity/history/${log.id}`, { replace: true })
    }
  })
  const discardMutation = useMutation({
    mutationFn: discardWorkout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['activity', 'active', userId]
      })
      navigate('/activity', { replace: true })
    }
  })

  if (activeQuery.isLoading)
    return (
      <ActivityPage>
        <LoadingBlock label="Tréning sa znovu otvára…" />
      </ActivityPage>
    )
  if (activeQuery.isError)
    return (
      <ActivityPage>
        <ErrorBlock message="Aktívny tréning sa nepodarilo načítať." />
      </ActivityPage>
    )
  if (!activeQuery.data) {
    return (
      <ActivityPage>
        <PageIntro eyebrow="Aktivita" title="Žiadny tréning neprebieha" description="Začni tréning z plánu. Dokončené série sa budú priebežne ukladať." />
        <button type="button" onClick={() => navigate('/activity/workouts')} className="min-h-11 cursor-pointer rounded-xl border-0 bg-action-primary px-5 text-sm font-bold text-on-action-primary">
          Vybrať tréning
        </button>
      </ActivityPage>
    )
  }

  const active = activeQuery.data
  const targetByName = new Map((workoutQuery.data?.workout_exercises ?? []).map(exercise => [exercise.name, exercise]))
  const setCount = active.exercise_logs.reduce((total, exercise) => total + exercise.set_logs.length, 0)
  const completeCount = active.exercise_logs.reduce((total, exercise) => total + exercise.set_logs.filter(set => set.completed).length, 0)

  return (
    <ActivityPage>
      <PageIntro eyebrow="Prebiehajúci tréning" title={active.workout_name} description={`${completeCount} z ${setCount} sérií je dokončených. Každá dokončená séria sa ukladá do tvojho účtu.`} action={<div className="rounded-full bg-surface-highest px-4 py-2 text-sm font-bold text-text-primary">{setCount ? Math.round((completeCount / setCount) * 100) : 0}%</div>} />

      {restUntil && (
        <div className="sticky top-2 z-20 flex items-center gap-4 rounded-2xl border border-accent/50 bg-background/95 p-4 shadow-xl backdrop-blur">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">
            <TimerReset size={20} />
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-text-accent">Časovač odpočinku</p>
            <p className="text-xl font-bold tabular-nums text-text-primary">
              {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}
            </p>
          </div>
          <button type="button" onClick={() => setRestUntil(null)} className="cursor-pointer rounded-xl border border-outline bg-surface px-3 py-2 text-sm font-semibold text-text-primary">
            Preskočiť
          </button>
        </div>
      )}

      <div className="space-y-4">
        {active.exercise_logs.map((exercise, index) => {
          const target = targetByName.get(exercise.exercise_name)
          return (
            <ExerciseSessionCard
              key={exercise.id}
              exercise={exercise}
              index={index}
              targetLabel={target?.reps ?? null}
              logType={target?.log_type ?? null}
              targetSeconds={target?.target_duration_seconds ?? null}
              restSeconds={target?.rest_seconds ?? exercise.set_logs[0]?.target_rest_seconds ?? 0}
              onChanged={refresh}
              onRest={seconds => {
                if (seconds > 0) setRestUntil(Date.now() + seconds * 1000)
              }}
            />
          )
        })}
      </div>

      <div className="rounded-2xl border border-outline bg-surface-elevated p-5">
        <label htmlFor="session-notes" className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          Poznámky k tréningu
        </label>
        <textarea id="session-notes" value={notes} onChange={event => setNotes(event.target.value)} rows={3} placeholder="Ako si sa pri tréningu cítil?" className="mt-2 w-full resize-y rounded-xl border border-outline bg-surface p-3 text-sm text-text-primary outline-none focus:border-accent" />
      </div>

      {(finishMutation.isError || discardMutation.isError) && <ErrorBlock message={(finishMutation.error ?? discardMutation.error)?.message} />}

      <div className="sticky bottom-3 z-20 flex flex-col gap-2 rounded-2xl border border-outline bg-background/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Zahodiť tento tréning? Uložené série zostanú v zahodenom tréningu, ale nebudú sa započítavať do pokroku.')) discardMutation.mutate(active.id)
          }}
          disabled={discardMutation.isPending || finishMutation.isPending}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-error/40 bg-error/10 px-4 text-sm font-semibold text-error disabled:opacity-40"
        >
          <X size={17} /> Zahodiť
        </button>
        <button type="button" onClick={() => finishMutation.mutate(active)} disabled={!completeCount || discardMutation.isPending || finishMutation.isPending} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-action-primary px-5 text-sm font-bold text-on-action-primary disabled:cursor-not-allowed disabled:opacity-40">
          <CircleStop size={18} /> {finishMutation.isPending ? 'Dokončuje sa…' : 'Ukončiť tréning'}
        </button>
      </div>
    </ActivityPage>
  )
}

function ExerciseSessionCard({ exercise, index, targetLabel, logType, targetSeconds, restSeconds, onChanged, onRest }: { exercise: ExerciseLogRow; index: number; targetLabel: string | null; logType: WorkoutExerciseRow['log_type']; targetSeconds: number | null; restSeconds: number; onChanged: () => Promise<unknown>; onRest: (seconds: number) => void }) {
  const [open, setOpen] = useState(true)
  // Authoritative: a plan's log_type decides timed vs. reps. Only fall back to the
  // legacy set-shape heuristic (existing duration values) when there is no plan at all.
  const timed = logType === 'time' || (logType == null && exercise.set_logs.some(set => set.actual_duration_seconds != null))
  const addMutation = useMutation({
    mutationFn: () => {
      const last = exercise.set_logs[exercise.set_logs.length - 1]
      return addSet(exercise.id, (last?.sort_order ?? 0) + 1, last?.target_reps ?? null, last?.target_rest_seconds ?? restSeconds)
    },
    onSuccess: onChanged
  })
  const deleteMutation = useMutation({
    mutationFn: removeSet,
    onSuccess: onChanged
  })
  const complete = exercise.set_logs.filter(set => set.completed).length

  return (
    <section className="overflow-hidden rounded-2xl border border-outline bg-surface-elevated">
      <button type="button" onClick={() => setOpen(value => !value)} className="flex w-full cursor-pointer items-center gap-4 border-0 bg-transparent p-5 text-left text-text-primary">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-highest text-sm font-bold">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold">{exercise.exercise_name}</span>
          <span className="mt-0.5 block text-xs text-text-secondary">
            {complete}/{exercise.set_logs.length} sérií · {targetLabel ?? 'Zapíš svoju sériu'}
          </span>
        </span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && (
        <div className="border-t border-outline-subtle px-3 pb-4 sm:px-5">
          <div className="hidden grid-cols-[2.5rem_1fr_1fr_5rem_3rem] gap-2 py-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary sm:grid">
            <span>Séria</span>
            <span>{timed ? 'Čas (s)' : 'Opakovania'}</span>
            <span>{timed ? 'RPE' : 'Váha (kg)'}</span>
            <span>RPE</span>
            <span></span>
          </div>
          <div className="space-y-2">
            {exercise.set_logs.map(set => (
              <SessionSetRow
                key={set.id}
                set={set}
                timed={timed}
                targetSeconds={targetSeconds}
                canDelete={exercise.set_logs.length > 1}
                deleting={deleteMutation.isPending}
                onDelete={() => deleteMutation.mutate(set.id)}
                onSaved={async completedNow => {
                  await onChanged()
                  if (completedNow) onRest(set.target_rest_seconds ?? restSeconds)
                }}
              />
            ))}
          </div>
          <button type="button" onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="mt-3 inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent px-1 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary">
            <Plus size={16} /> Pridať sériu
          </button>
          {(addMutation.isError || deleteMutation.isError) && (
            <p role="alert" className="mt-2 text-sm text-error">
              {(addMutation.error ?? deleteMutation.error)?.message}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function SessionSetRow({ set, timed, targetSeconds, canDelete, deleting, onDelete, onSaved }: { set: SetLogRow; timed: boolean; targetSeconds: number | null; canDelete: boolean; deleting: boolean; onDelete: () => void; onSaved: (completedNow: boolean) => Promise<unknown> }) {
  const [draft, setDraft] = useState(() => draftFromSet(set))
  const [stopwatch, setStopwatch] = useState<{ startedAt: number; baseline: number } | null>(null)
  const payload = useMemo(
    () => ({
      actual_reps: timed ? null : nullableNumber(draft.reps),
      actual_weight_kg: timed ? null : nullableNumber(draft.weight),
      actual_duration_seconds: timed ? nullableNumber(draft.duration) : null,
      rpe: nullableNumber(draft.rpe)
    }),
    [draft, timed]
  )
  const saveMutation = useMutation({
    mutationFn: (completed: boolean) => saveSet(set.id, { ...payload, completed }),
    onSuccess: (_data, completed) => onSaved(completed && !set.completed)
  })

  // Wall-clock anchored count-up: each tick (and the pause itself) recomputes the
  // elapsed seconds from Date.now(), so backgrounding the tab self-corrects instead
  // of drifting like a plain incrementing counter would.
  useEffect(() => {
    if (!stopwatch) return
    const tick = () => {
      setDraft(value => ({ ...value, duration: String(stopwatch.baseline + Math.floor((Date.now() - stopwatch.startedAt) / 1000)) }))
    }
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [stopwatch])

  // Stop ticking once the set is saved as completed so the field freezes.
  useEffect(() => {
    if (set.completed) setStopwatch(null)
  }, [set.completed])

  const toggleStopwatch = () => {
    if (stopwatch) {
      setDraft(value => ({ ...value, duration: String(stopwatch.baseline + Math.floor((Date.now() - stopwatch.startedAt) / 1000)) }))
      setStopwatch(null)
    } else {
      setStopwatch({ startedAt: Date.now(), baseline: nullableNumber(draft.duration) ?? 0 })
    }
  }

  return (
    <div className={`grid grid-cols-[2.5rem_1fr_1fr_3rem] gap-2 rounded-xl border p-2 sm:grid-cols-[2.5rem_1fr_1fr_5rem_3rem] ${set.completed ? 'border-success/50 bg-success/10' : 'border-outline-subtle bg-surface'}`}>
      <span className="flex items-center justify-center text-sm font-bold text-text-secondary">{set.sort_order}</span>
      {timed ? (
        <div className="flex min-w-0 items-center gap-1">
          <input
            aria-label={`Séria ${set.sort_order} trvanie v sekundách`}
            type="number"
            min="0"
            inputMode="decimal"
            value={draft.duration}
            placeholder={targetSeconds ? formatSeconds(targetSeconds) : undefined}
            onChange={event => setDraft(value => ({ ...value, duration: event.target.value }))}
            className="min-w-0 flex-1 rounded-lg border border-outline bg-background px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
          <button
            type="button"
            aria-label={stopwatch ? `Zastaviť časovač série ${set.sort_order}` : `Spustiť časovač série ${set.sort_order}`}
            onClick={toggleStopwatch}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-outline bg-surface-highest text-text-primary"
          >
            {stopwatch ? <Pause size={15} /> : <Play size={15} />}
          </button>
        </div>
      ) : (
        <input
          aria-label={`Séria ${set.sort_order} opakovania`}
          type="number"
          min="0"
          inputMode="decimal"
          value={draft.reps}
          onChange={event => setDraft(value => ({ ...value, reps: event.target.value }))}
          className="min-w-0 rounded-lg border border-outline bg-background px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
      )}
      {timed ? (
        <>
          <input aria-label={`Séria ${set.sort_order} RPE`} type="number" min="1" max="10" inputMode="numeric" value={draft.rpe} onChange={event => setDraft(value => ({ ...value, rpe: event.target.value }))} className="min-w-0 rounded-lg border border-outline bg-background px-2 py-2 text-sm text-text-primary outline-none focus:border-accent sm:hidden" />
          <span className="hidden items-center text-text-secondary sm:flex">—</span>
        </>
      ) : (
        <input aria-label={`Séria ${set.sort_order} váha v kilogramoch`} type="number" min="0" step="0.5" inputMode="decimal" value={draft.weight} onChange={event => setDraft(value => ({ ...value, weight: event.target.value }))} className="min-w-0 rounded-lg border border-outline bg-background px-2 py-2 text-sm text-text-primary outline-none focus:border-accent" />
      )}
      <input aria-label={`Séria ${set.sort_order} RPE na počítači`} type="number" min="1" max="10" inputMode="numeric" value={draft.rpe} onChange={event => setDraft(value => ({ ...value, rpe: event.target.value }))} className="hidden min-w-0 rounded-lg border border-outline bg-background px-2 py-2 text-sm text-text-primary outline-none focus:border-accent sm:block" />
      <div className="flex items-center justify-end gap-1">
        {canDelete && !set.completed && (
          <button type="button" aria-label={`Odstrániť sériu ${set.sort_order}`} onClick={onDelete} disabled={deleting} className="hidden cursor-pointer border-0 bg-transparent p-1 text-text-secondary hover:text-error sm:block">
            <Trash2 size={15} />
          </button>
        )}
        <button type="button" aria-label={set.completed ? `Označiť sériu ${set.sort_order} ako nedokončenú` : `Dokončiť sériu ${set.sort_order}`} onClick={() => saveMutation.mutate(!set.completed)} disabled={saveMutation.isPending} className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border ${set.completed ? 'border-success bg-success text-white' : 'border-outline bg-surface-highest text-text-primary'}`}>
          {saveMutation.isPending ? <Save size={15} /> : <Check size={17} />}
        </button>
      </div>
      {saveMutation.isError && (
        <p role="alert" className="col-span-full text-xs text-error">
          {saveMutation.error.message}
        </p>
      )}
    </div>
  )
}
