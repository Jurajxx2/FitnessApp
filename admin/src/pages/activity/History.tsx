import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BarChart3, ChevronRight, Clock3, Dumbbell, Pencil, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  deleteGeneralActivity,
  deleteWorkoutLog,
  getGeneralActivities,
  getWorkoutFeedback,
  getWorkoutHistoryPage,
  getWorkoutLog,
  updateWorkoutLog,
} from '../../activity/api'
import { completedSets, formatDate, formatDuration, toLocalDateTimeInputValue, workoutVolume } from '../../activity/logic'
import { useAuth } from '../../hooks/useAuth'
import { formatSeconds } from '../../workouts/builder'
import { ConfirmDialog, Modal, Pagination, useNotice } from '../../components/ui'
import type { WorkoutFeedback } from '../../types/database'
import { ACTIVITY_TYPE_OPTIONS, ActivityPage, ActivityTypeIcon, ErrorBlock, LoadingBlock, PageIntro } from './shared'

export default function WorkoutHistory() {
  const { logId } = useParams()
  return logId ? <HistoryDetail logId={logId} /> : <HistoryList />
}

function HistoryList() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { notify } = useNotice()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(12)
  const historyQuery = useQuery({
    queryKey: ['activity', 'history', userId, page, pageSize],
    queryFn: () => getWorkoutHistoryPage(userId, page, pageSize),
    enabled: Boolean(userId)
  })
  const activitiesQuery = useQuery({
    queryKey: ['activity', 'general', userId],
    queryFn: () => getGeneralActivities(userId),
    enabled: Boolean(userId)
  })
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null)
  const deleteActivity = useMutation({
    mutationFn: (activityId: string) => deleteGeneralActivity(userId, activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', 'general', userId] })
      notify('Aktivita bola vymazaná.')
      setDeleteActivityId(null)
    },
    onError: () => notify('Aktivitu sa nepodarilo vymazať.', 'error')
  })

  if (historyQuery.isLoading)
    return (
      <ActivityPage>
        <LoadingBlock label="Načítava sa história tréningov…" />
      </ActivityPage>
    )
  if (historyQuery.isError)
    return (
      <ActivityPage>
        <ErrorBlock message="Históriu tréningov sa nepodarilo načítať." />
      </ActivityPage>
    )
  const history = historyQuery.data?.data ?? []
  const totalHistory = historyQuery.data?.count ?? 0
  const activities = activitiesQuery.data ?? []

  return (
    <ActivityPage>
      <PageIntro
        eyebrow="Aktivita"
        title="História tréningov"
        description="Prehľad dokončených tréningov, sérií, opakovaní, váh a tréningového objemu."
        action={
          <Link to="/activity/progress" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline px-4 text-sm font-semibold text-text-primary no-underline">
            <BarChart3 size={16} /> Pokrok
          </Link>
        }
      />
      {history.length ? (
        <>
          <div className="space-y-3">
            {history.map(log => {
              const volume = workoutVolume(log)
              return (
                <Link key={log.id} to={`/activity/history/${log.id}`} className="flex items-center gap-4 rounded-2xl border border-outline bg-surface-elevated p-4 text-inherit no-underline hover:bg-surface-highest sm:p-5">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-surface-highest text-text-primary">
                    <Dumbbell size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-text-primary">{log.workout_name}</span>
                    <span className="mt-1 block text-xs text-text-secondary">
                      {formatDate(log.logged_at, {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-3 text-xs text-text-secondary">
                      <span>{formatDuration(log.duration_minutes)}</span>
                      <span>{completedSets(log)} sérií</span>
                      {volume > 0 && <span>{Math.round(volume).toLocaleString()} kg objem</span>}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-text-secondary" />
                </Link>
              )
            })}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={totalHistory}
            pageSizeOptions={[12, 24, 48]}
            onPageChange={setPage}
            onPageSizeChange={size => { setPageSize(size); setPage(0) }}
            standalone
          />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-outline p-8 text-center">
          <p className="font-semibold text-text-primary">Zatiaľ žiadne dokončené tréningy</p>
          <p className="mt-1 text-sm text-text-secondary">Začni tréning a dokonči aspoň jednu sériu, aby sa začala tvoriť história.</p>
          <Link to="/activity/workouts" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-action-primary px-4 text-sm font-bold text-on-action-primary no-underline">
            Vybrať tréning
          </Link>
        </div>
      )}
      <div className="space-y-3">
        <h3 className="flex items-center gap-2.5 font-display text-lg font-bold text-text-primary">
          <span className="h-4 w-1 shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
          Ostatné aktivity
        </h3>
        {activitiesQuery.isLoading ? (
          <LoadingBlock label="Načítavajú sa aktivity…" />
        ) : activitiesQuery.isError ? (
          <ErrorBlock message="Aktivity sa nepodarilo načítať." />
        ) : activities.length ? (
          <div className="space-y-3">
            {activities.map(activity => (
              <div key={activity.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-outline bg-surface-elevated p-4 sm:p-5">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-surface-highest text-text-primary">
                  <ActivityTypeIcon type={activity.activity_type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-text-primary">
                    {ACTIVITY_TYPE_OPTIONS.find(option => option.value === activity.activity_type)?.label ?? activity.activity_type}
                  </span>
                  <span className="mt-1 block text-xs text-text-secondary">
                    {formatDate(activity.logged_at, { dateStyle: 'medium', timeStyle: 'short' })} · {formatDuration(activity.duration_minutes)}
                    {activity.distance_km ? ` · ${activity.distance_km} km` : ''}
                  </span>
                </span>
                <span className="flex flex-shrink-0 gap-2">
                  <Link
                    to={`/activity/log?activityId=${activity.id}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-outline bg-surface px-3 text-sm font-semibold text-text-primary no-underline hover:bg-surface-highest"
                  >
                    <Pencil size={14} aria-hidden="true" /> Upraviť
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleteActivityId(activity.id)}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-error/40 bg-error/10 px-3 text-sm font-semibold text-error hover:bg-error/20"
                  >
                    <Trash2 size={14} aria-hidden="true" /> Vymazať
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-outline p-6 text-sm text-text-secondary">Zatiaľ nemáš zapísané žiadne všeobecné aktivity.</p>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(deleteActivityId)}
        title="Vymazať aktivitu?"
        description="Táto aktivita sa natrvalo odstráni z histórie."
        confirmLabel="Vymazať"
        cancelLabel="Zrušiť"
        confirmVariant="danger"
        pending={deleteActivity.isPending}
        onClose={() => setDeleteActivityId(null)}
        onConfirm={() => { if (deleteActivityId) deleteActivity.mutate(deleteActivityId) }}
      />
    </ActivityPage>
  )
}

function HistoryDetail({ logId }: { logId: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const logQuery = useQuery({
    queryKey: ['activity', 'history', userId, logId],
    queryFn: () => getWorkoutLog(userId, logId),
    enabled: Boolean(userId)
  })
  const feedbackQuery = useQuery({
    queryKey: ['activity', 'workout-feedback', userId, logId],
    queryFn: () => getWorkoutFeedback(userId, logId, (logQuery.data?.exercise_logs ?? []).map(exercise => exercise.id)),
    enabled: Boolean(userId) && Boolean(logQuery.data)
  })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editLoggedAt, setEditLoggedAt] = useState('')
  const [editNotes, setEditNotes] = useState('')

  function invalidateAfterMutation() {
    // The 'activity','history' prefix covers the paginated list, this detail query and
    // Progress (which keys its own totals query as exactly ['activity','history',userId]).
    // The feedback query is invalidated too: edits are scoped to logged_at/notes only so the
    // exercise_log ids it depends on can't go stale, but this keeps it correct by construction
    // rather than by that invariant, and a delete must not leave stale feedback cached either.
    queryClient.invalidateQueries({ queryKey: ['activity', 'history', userId] })
    queryClient.invalidateQueries({ queryKey: ['activity', 'workout-feedback', userId, logId] })
  }

  const deleteLog = useMutation({
    mutationFn: () => deleteWorkoutLog(userId, logId),
    onSuccess: () => {
      invalidateAfterMutation()
      notify('Tréning bol vymazaný.')
      navigate('/activity/history')
    },
    onError: () => notify('Tréning sa nepodarilo vymazať.', 'error')
  })

  const updateLog = useMutation({
    mutationFn: (values: { logged_at: string; notes: string | null }) => updateWorkoutLog(userId, logId, values),
    onSuccess: () => {
      invalidateAfterMutation()
      notify('Tréning bol upravený.')
      setEditOpen(false)
    },
    onError: () => notify('Tréning sa nepodarilo upraviť.', 'error')
  })

  if (logQuery.isLoading)
    return (
      <ActivityPage>
        <LoadingBlock label="Načítava sa súhrn tréningu…" />
      </ActivityPage>
    )
  if (logQuery.isError || !logQuery.data)
    return (
      <ActivityPage>
        <ErrorBlock message="Súhrn tohto tréningu sa nepodarilo načítať." />
      </ActivityPage>
    )
  const log = logQuery.data
  const volume = workoutVolume(log)
  const feedback = feedbackQuery.data ?? []
  const sessionFeedback = feedback.filter(item => item.workout_log_id)
  const feedbackByExercise = new Map<string, WorkoutFeedback[]>()
  for (const item of feedback) {
    if (!item.exercise_log_id) continue
    feedbackByExercise.set(item.exercise_log_id, [...(feedbackByExercise.get(item.exercise_log_id) ?? []), item])
  }

  function openEdit() {
    setEditLoggedAt(toLocalDateTimeInputValue(new Date(log.logged_at)))
    setEditNotes(log.notes ?? '')
    setEditOpen(true)
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault()
    updateLog.mutate({ logged_at: new Date(editLoggedAt).toISOString(), notes: editNotes.trim() || null })
  }

  return (
    <ActivityPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/activity/history" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary no-underline hover:text-text-primary">
          <ArrowLeft size={16} /> História tréningov
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-outline bg-surface px-4 text-sm font-semibold text-text-primary hover:bg-surface-highest"
          >
            <Pencil size={15} aria-hidden="true" /> Upraviť
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-error/40 bg-error/10 px-4 text-sm font-semibold text-error hover:bg-error/20"
          >
            <Trash2 size={15} aria-hidden="true" /> Vymazať
          </button>
        </div>
      </div>
      <div className="rounded-3xl border border-outline bg-surface-elevated p-6 sm:p-8">
        <p className="ledger-label text-success">Tréning dokončený</p>
        <h2 className="mt-2 text-3xl font-display font-bold tracking-tight text-text-primary">{log.workout_name}</h2>
        <p className="mt-2 text-sm text-text-secondary">{formatDate(log.logged_at, { dateStyle: 'full', timeStyle: 'short' })}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Trvanie" value={formatDuration(log.duration_minutes)} icon={<Clock3 size={17} />} />
          <Metric label="Cviky" value={String(log.exercise_logs.length)} icon={<Dumbbell size={17} />} />
          <Metric label="Dokončené série" value={String(completedSets(log))} />
          <Metric label="Objem" value={volume ? `${Math.round(volume).toLocaleString()} kg` : '—'} />
        </div>
        {log.notes && <p className="mt-5 rounded-xl bg-surface p-4 text-sm leading-6 text-text-secondary">{log.notes}</p>}
      </div>
      {sessionFeedback.length > 0 && <FeedbackNote label="Spätná väzba od trénera" items={sessionFeedback} />}
      <div className="space-y-4">
        {log.exercise_logs.map(exercise => {
          const exerciseFeedback = feedbackByExercise.get(exercise.id) ?? []
          return (
            <section key={exercise.id} className="overflow-hidden rounded-2xl border border-outline bg-surface-elevated">
              <div className="p-5">
                <h3 className="font-bold text-text-primary">{exercise.exercise_name}</h3>
                <p className="mt-1 text-xs text-text-secondary">{exercise.set_logs.filter(set => set.completed).length || exercise.sets_completed || 0} dokončených sérií</p>
              </div>
              {exercise.set_logs.length > 0 ? (
                <div className="border-t border-outline-subtle px-5 pb-4">
                  <div className="grid grid-cols-5 gap-2 py-3 ledger-label text-text-secondary">
                    <span>Séria</span>
                    <span>Opakovania</span>
                    <span>Váha</span>
                    <span>Čas</span>
                    <span>RPE</span>
                  </div>
                  {exercise.set_logs.map(set => (
                    <div key={set.id} className={`grid grid-cols-5 gap-2 border-t border-outline-subtle py-3 text-sm ${set.completed ? 'text-text-primary' : 'text-text-secondary'}`}>
                      <span className="font-semibold">{set.sort_order}</span>
                      <span>{set.actual_reps ?? '—'}</span>
                      <span>{set.actual_weight_kg != null ? `${set.actual_weight_kg} kg` : '—'}</span>
                      <span>{set.actual_duration_seconds != null ? formatSeconds(set.actual_duration_seconds) : '—'}</span>
                      <span>{set.rpe ?? '—'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="border-t border-outline-subtle p-5 text-sm text-text-secondary">
                  Starší záznam: {exercise.sets_completed ?? 0} sérií · {exercise.reps_completed ?? 'opakovaní nezaznamenané'} · {exercise.weight_kg != null ? `${exercise.weight_kg} kg` : 'váha nezaznamenaná'}
                </p>
              )}
              {exerciseFeedback.length > 0 && (
                <div className="border-t border-outline-subtle p-5">
                  <FeedbackNote label="Poznámka trénera" items={exerciseFeedback} />
                </div>
              )}
            </section>
          )
        })}
      </div>
      <ConfirmDialog
        open={deleteOpen}
        title="Vymazať tréning?"
        description="Tento tréningový záznam sa natrvalo odstráni z histórie aj zo štatistík."
        confirmLabel="Vymazať"
        cancelLabel="Zrušiť"
        confirmVariant="danger"
        pending={deleteLog.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteLog.mutate()}
      />
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Upraviť tréning">
        <form onSubmit={submitEdit} className="space-y-4">
          <label className="block">
            <span className="ledger-label text-text-secondary">Dátum a čas</span>
            <input
              type="datetime-local"
              value={editLoggedAt}
              onChange={event => setEditLoggedAt(event.target.value)}
              required
              className="mt-2 h-11 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="ledger-label text-text-secondary">Poznámky</span>
            <textarea
              value={editNotes}
              onChange={event => setEditNotes(event.target.value)}
              rows={4}
              className="mt-2 w-full resize-y rounded-xl border border-outline bg-surface p-3 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          {updateLog.isError && (
            <p role="alert" className="text-sm text-error">Tréning sa nepodarilo upraviť.</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              disabled={updateLog.isPending}
              className="inline-flex min-h-11 items-center rounded-xl border border-outline bg-surface px-4 text-sm font-semibold text-text-primary disabled:opacity-40"
            >
              Zrušiť
            </button>
            <button
              type="submit"
              disabled={updateLog.isPending}
              className="inline-flex min-h-11 items-center rounded-xl border-0 bg-action-primary px-4 text-sm font-bold text-on-action-primary disabled:opacity-40"
            >
              {updateLog.isPending ? 'Ukladá sa…' : 'Uložiť'}
            </button>
          </div>
        </form>
      </Modal>
    </ActivityPage>
  )
}

function FeedbackNote({ label, items }: { label: string; items: WorkoutFeedback[] }) {
  return (
    <div className="space-y-3 rounded-xl border-l-2 border-accent bg-surface-highest p-4">
      <p className="ledger-label text-text-secondary">{label}</p>
      {items.map(item => (
        <div key={item.id}>
          <p className="text-sm leading-6 text-text-primary">{item.body}</p>
          <p className="mt-1 text-xs text-text-secondary">{formatDate(item.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
      ))}
    </div>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="flex items-center gap-2 text-xs text-text-secondary">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-xl font-display font-bold tabular-nums text-text-primary">{value}</p>
    </div>
  )
}
