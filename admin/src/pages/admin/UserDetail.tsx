// admin/src/pages/admin/UserDetail.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Badge, Button, Card, ConfirmDialog, EditorPage, EmptyState, Shimmer, useNotice } from '../../components/ui'
import { BodyFocusMap } from '../../components/BodyFocusMap'
import { CheckInsSection } from './CheckInsSection'
import { AthleteManagementPanel } from './AthleteManagementPanel'
import type {
  ExerciseLog,
  MealLog,
  MealLogFood,
  MealPlan,
  OnboardingResponse,
  Profile,
  SetLog,
  WeightEntry,
  Workout,
  WorkoutFeedback,
  WorkoutLog,
} from '../../types/database'

type WorkoutLogWithExercises = WorkoutLog & {
  exercise_logs?: Array<ExerciseLog & { set_logs?: SetLog[] }>
}

type MealLogWithFoods = MealLog & {
  meal_log_foods?: MealLogFood[]
}

type FeedbackTarget =
  | { type: 'workout'; id: string }
  | { type: 'exercise'; id: string }

export type AccountAction = 'block' | 'unblock' | 'promote_admin' | 'delete'

interface ManageUserResponse {
  action: AccountAction
  userId: string
}

const ACCOUNT_ACTION_COPY: Record<AccountAction, {
  title: string
  description: (name: string) => string
  confirmLabel: string
  confirmVariant: 'primary' | 'danger'
  success: string
}> = {
  block: {
    title: 'Disable this account?',
    description: name => `${name} will immediately lose access to protected app data. Their existing session may stay open until it refreshes or expires.`,
    confirmLabel: 'Disable account',
    confirmVariant: 'danger',
    success: 'User account disabled.',
  },
  unblock: {
    title: 'Activate this account?',
    description: name => `${name} will regain access to the athlete app and protected data.`,
    confirmLabel: 'Activate account',
    confirmVariant: 'primary',
    success: 'User account activated.',
  },
  promote_admin: {
    title: 'Grant admin access?',
    description: name => `${name} will be able to manage users, plans, workouts, nutrition, and other admin data. This also activates a disabled account.`,
    confirmLabel: 'Make admin',
    confirmVariant: 'primary',
    success: 'Admin access granted.',
  },
  delete: {
    title: 'Permanently delete this user?',
    description: name => `${name} and the account’s related app data will be permanently removed. This cannot be undone.`,
    confirmLabel: 'Delete user',
    confirmVariant: 'danger',
    success: 'User deleted.',
  },
}

export function AccountAccessControls({
  userName,
  isBlocked,
  pending,
  onConfirm,
}: {
  userName: string
  isBlocked: boolean
  pending: boolean
  onConfirm: (action: AccountAction) => Promise<unknown>
}) {
  const [action, setAction] = useState<AccountAction | null>(null)
  const dialog = action ? ACCOUNT_ACTION_COPY[action] : null

  async function confirm() {
    if (!action) return
    try {
      await onConfirm(action)
      setAction(null)
    } catch {
      // The owning mutation shows the error and the dialog stays open for retry.
    }
  }

  return (
    <>
      <Card className="border-error/30">
        <h2 className="text-sm font-bold text-text-primary">Account access</h2>
        <p className="mt-2 text-xs leading-5 text-text-secondary">
          {isBlocked
            ? 'This account is disabled and cannot access protected app data.'
            : 'This athlete can currently access the app. Confirm every access or role change before it is applied.'}
        </p>
        <div className="mt-4 grid gap-2">
          <Button
            variant={isBlocked ? 'primary' : 'danger'}
            className="w-full"
            onClick={() => setAction(isBlocked ? 'unblock' : 'block')}
          >
            {isBlocked ? 'Activate account' : 'Disable account'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setAction('promote_admin')}>
            Make user an admin
          </Button>
          <Button variant="danger" className="w-full" onClick={() => setAction('delete')}>
            Delete user
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.title ?? ''}
        description={dialog?.description(userName) ?? ''}
        confirmLabel={dialog?.confirmLabel}
        confirmVariant={dialog?.confirmVariant}
        pending={pending}
        onClose={() => { if (!pending) setAction(null) }}
        onConfirm={confirm}
      />
    </>
  )
}

function useUser(id: string) {
  return useQuery<Profile>({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

function useWorkoutPlans() {
  return useQuery<Pick<Workout, 'id' | 'name'>[]>({
    queryKey: ['workout-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('workouts').select('id, name').eq('source', 'coach').eq('is_active', true).order('name')
      return (data ?? []) as Pick<Workout, 'id' | 'name'>[]
    },
  })
}

function useWeightHistory(userId: string) {
  return useQuery<WeightEntry[]>({
    queryKey: ['weight-history', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(10)
      return data ?? []
    },
  })
}

function useUserCompliance(userId: string) {
  return useQuery({
    queryKey: ['user-compliance', userId],
    queryFn: async () => {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const [workouts, meals] = await Promise.all([
        supabase.from('workout_logs').select('*').eq('user_id', userId).gte('logged_at', sevenDaysAgo.toISOString()),
        supabase.from('meal_logs').select('*, meal_log_foods(*)').eq('user_id', userId).gte('logged_at', sevenDaysAgo.toISOString())
      ])
      
      const mealLogs = (meals.data ?? []) as any[]
      let totalCals = 0
      let totalProt = 0
      mealLogs.forEach(log => {
        (log.meal_log_foods ?? []).forEach((f: any) => {
          totalCals += f.calories
          totalProt += f.protein_g
        })
      })

      return {
        workoutsCompleted: workouts.data?.length ?? 0,
        avgCalories: mealLogs.length > 0 ? Math.round(totalCals / 7) : 0,
        avgProtein: mealLogs.length > 0 ? Math.round(totalProt / 7) : 0,
        logCount: mealLogs.length
      }
    }
  })
}

function useRecentWorkoutLogs(userId: string) {
  return useQuery<WorkoutLogWithExercises[]>({
    queryKey: ['user-workout-logs', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_logs')
        .select(`
          id,
          user_id,
          workout_id,
          workout_name,
          duration_minutes,
          notes,
          status,
          logged_at,
          created_at,
          exercise_logs (
            id,
            workout_log_id,
            exercise_name,
            sets_completed,
            reps_completed,
            weight_kg,
            notes,
            created_at,
            set_logs (
              id,
              exercise_log_id,
              sort_order,
              target_reps,
              actual_reps,
              target_weight_kg,
              actual_weight_kg,
              rpe,
              completed,
              created_at
            )
          )
        `)
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as unknown as WorkoutLogWithExercises[]
    },
  })
}

function useRecentMealLogs(userId: string) {
  return useQuery<MealLogWithFoods[]>({
    queryKey: ['user-meal-logs', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_logs')
        .select(`
          id,
          user_id,
          meal_name,
          notes,
          image_url,
          logged_at,
          created_at,
          meal_log_foods (
            id,
            meal_log_id,
            name,
            amount,
            unit,
            amount_grams,
            calories,
            protein_g,
            carbs_g,
            fat_g
          )
        `)
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as unknown as MealLogWithFoods[]
    },
  })
}

function useWorkoutFeedback(userId: string) {
  return useQuery<WorkoutFeedback[]>({
    queryKey: ['user-workout-feedback', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_feedback')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WorkoutFeedback[]
    },
  })
}

function useOnboardingResponse(userId: string) {
  return useQuery<OnboardingResponse | null>({
    queryKey: ['onboarding-response', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('onboarding_responses')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      return data
    },
  })
}

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert',
}
const EQUIPMENT_LABELS: Record<string, string> = {
  no_equipment: 'No equipment', dumbbells: 'Dumbbells', home_gym: 'Home gym', full_gym: 'Full gym',
}
const TRAINING_LABELS: Record<string, string> = {
  with_coach: 'With coach', self_guided: 'Self-guided', both: 'Both',
}

function useMealPlans() {
  return useQuery<Pick<MealPlan, 'id' | 'name'>[]>({
    queryKey: ['meal-plans-admin'],
    queryFn: async () => {
      const { data } = await supabase.from('meal_plans').select('id, name').eq('origin', 'manual').eq('is_active', true).order('name')
      return data ?? []
    },
  })
}

function useUserMealPlan(userId: string) {
  return useQuery<string | null>({
    queryKey: ['user-meal-plan', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_current_meal_plan_id', { p_user_id: userId })
      if (error) throw error
      return (data as Array<{ meal_plan_id: string }> | null)?.[0]?.meal_plan_id ?? null
    },
  })
}

function useUserWorkoutPlans(userId: string) {
  return useQuery<string[]>({
    queryKey: ['user-workout-plans', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_workouts')
        .select('workout_id')
        .eq('user_id', userId)
      if (error) throw error
      return (data ?? []).map(row => row.workout_id)
    },
  })
}

const GOAL_LABELS: Record<string, string> = {
  build_muscle: 'Build muscle',
  lose_weight: 'Lose weight',
  stay_fit: 'Stay fit',
  get_stronger: 'Get stronger',
}
function deriveStatus(p: Profile): 'active' | 'inactive' | 'blocked' {
  if (p.is_blocked) return 'blocked'
  if (!p.onboarding_complete) return 'inactive'
  return 'active'
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseLegacyReps(value: string | null): number | null {
  if (!value) return null
  const first = value.split('-')[0]?.trim()
  if (!first || !/^\d+$/.test(first)) return null
  return Number(first)
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function mealTotals(log: MealLogWithFoods) {
  return (log.meal_log_foods ?? []).reduce(
    (acc, food) => ({
      calories: acc.calories + (food.calories ?? 0),
      protein: acc.protein + (food.protein_g ?? 0),
      carbs: acc.carbs + (food.carbs_g ?? 0),
      fat: acc.fat + (food.fat_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

function workoutTotals(log: WorkoutLogWithExercises) {
  return (log.exercise_logs ?? []).reduce(
    (acc, exercise) => {
      const sets = (exercise.set_logs ?? [])
        .filter(set => set.completed || set.actual_reps != null || set.actual_weight_kg != null)
      if (sets.length > 0) {
        const volume = sets.reduce((sum, set) => {
          const reps = set.actual_reps ?? 0
          const weight = set.actual_weight_kg ?? 0
          return sum + reps * weight
        }, 0)
        return { sets: acc.sets + sets.length, volumeKg: acc.volumeKg + volume }
      }

      const reps = parseLegacyReps(exercise.reps_completed)
      const setsCompleted = exercise.sets_completed ?? 0
      const weight = exercise.weight_kg ?? 0
      const legacyVolume = reps && weight ? setsCompleted * reps * weight : 0
      return { sets: acc.sets + setsCompleted, volumeKg: acc.volumeKg + legacyVolume }
    },
    { sets: 0, volumeKg: 0 }
  )
}

function feedbackForTarget(feedback: WorkoutFeedback[], target: FeedbackTarget): WorkoutFeedback[] {
  return feedback.filter(item =>
    target.type === 'workout'
      ? item.workout_log_id === target.id
      : item.exercise_log_id === target.id
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
      {children}
    </p>
  )
}

function TargetFeedback({
  target,
  feedback,
  onAdd,
  onDelete,
  isPending,
}: {
  target: FeedbackTarget
  feedback: WorkoutFeedback[]
  onAdd: (target: FeedbackTarget, body: string) => void
  onDelete: (id: string) => void
  isPending: boolean
}) {
  const [draft, setDraft] = useState('')
  const label = target.type === 'workout' ? 'Workout comment' : 'Exercise comment'

  function handleSubmit() {
    const body = draft.trim()
    if (!body) return
    onAdd(target, body)
    setDraft('')
  }

  return (
    <div className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--input-bg)] p-2">
      <p className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-wider mb-2">
        Coach feedback
      </p>
      {feedback.length > 0 ? (
        <div className="flex flex-col gap-2 mb-2">
          {feedback.map(item => (
            <div key={item.id} className="rounded bg-[var(--bg-card)] border border-[var(--border)] p-2">
              <p className="text-xs text-[var(--text-muted)] whitespace-pre-wrap">{item.body}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[10px] text-[var(--text-disabled)]">{formatDateTime(item.created_at)}</span>
                <button
                  type="button"
                  className="text-[10px] text-red-400 bg-transparent border-0 cursor-pointer p-0"
                  onClick={() => onDelete(item.id)}
                  disabled={isPending}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-disabled)] mb-2">No feedback yet.</p>
      )}
      <textarea
        className="w-full min-h-16 resize-y rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none"
        placeholder={label}
        value={draft}
        onChange={event => setDraft(event.target.value)}
      />
      <Button
        variant="ghost"
        className="mt-2 w-full py-1.5 text-xs"
        onClick={handleSubmit}
        loading={isPending}
        disabled={!draft.trim()}
      >
        Add feedback
      </Button>
    </div>
  )
}

function WorkoutLogsSection({
  logs,
  isLoading,
  error,
  feedback,
  onAddFeedback,
  onDeleteFeedback,
  isFeedbackPending,
}: {
  logs: WorkoutLogWithExercises[]
  isLoading: boolean
  error: Error | null
  feedback: WorkoutFeedback[]
  onAddFeedback: (target: FeedbackTarget, body: string) => void
  onDeleteFeedback: (id: string) => void
  isFeedbackPending: boolean
}) {
  return (
    <div>
      <SectionTitle>Recent Workout Logs</SectionTitle>
      {isLoading && <p className="text-sm text-[var(--text-disabled)]">Loading workout logs…</p>}
      {error && <p className="text-sm text-red-400">{error.message}</p>}
      {!isLoading && !error && logs.length === 0 && (
        <p className="text-sm text-[var(--text-disabled)]">No workout logs yet.</p>
      )}
      <div className="flex flex-col gap-2">
        {logs.map(log => {
          const totals = workoutTotals(log)
          return (
            <div key={log.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">{log.workout_name}</p>
                  <p className="text-xs text-[var(--text-disabled)]">{formatDateTime(log.logged_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">{log.duration_minutes} min</p>
                  <p className="text-[10px] text-[var(--text-disabled)]">{totals.sets} sets · {formatNumber(totals.volumeKg)} kg</p>
                </div>
              </div>
              {(log.exercise_logs ?? []).length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {(log.exercise_logs ?? []).map(exercise => {
                    const sets = [...(exercise.set_logs ?? [])].sort((a, b) => a.sort_order - b.sort_order)
                    return (
                      <div key={exercise.id} className="border-t border-[var(--border-subtle)] pt-2">
                        <p className="text-xs font-semibold text-[var(--text-muted)]">{exercise.exercise_name}</p>
                        {sets.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {sets.map(set => (
                              <span key={set.id} className="text-[10px] px-2 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text-muted)]">
                                Set {set.sort_order}: {set.actual_reps ?? '—'} reps
                                {set.actual_weight_kg != null ? ` · ${formatNumber(set.actual_weight_kg)} kg` : ''}
                                {set.rpe != null ? ` · RPE ${set.rpe}` : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[var(--text-disabled)] mt-1">
                            {exercise.sets_completed ?? 0} sets · {exercise.reps_completed ?? '—'} reps
                            {exercise.weight_kg != null ? ` · ${formatNumber(exercise.weight_kg)} kg` : ''}
                          </p>
                        )}
                        <TargetFeedback
                          target={{ type: 'exercise', id: exercise.id }}
                          feedback={feedbackForTarget(feedback, { type: 'exercise', id: exercise.id })}
                          onAdd={onAddFeedback}
                          onDelete={onDeleteFeedback}
                          isPending={isFeedbackPending}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
              {log.notes && <p className="mt-2 text-xs text-[var(--text-disabled)]">{log.notes}</p>}
              <TargetFeedback
                target={{ type: 'workout', id: log.id }}
                feedback={feedbackForTarget(feedback, { type: 'workout', id: log.id })}
                onAdd={onAddFeedback}
                onDelete={onDeleteFeedback}
                isPending={isFeedbackPending}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MealLogsSection({
  logs,
  isLoading,
  error,
}: {
  logs: MealLogWithFoods[]
  isLoading: boolean
  error: Error | null
}) {
  return (
    <div>
      <SectionTitle>Recent Nutrition Logs</SectionTitle>
      {isLoading && <p className="text-sm text-[var(--text-disabled)]">Loading nutrition logs…</p>}
      {error && <p className="text-sm text-red-400">{error.message}</p>}
      {!isLoading && !error && logs.length === 0 && (
        <p className="text-sm text-[var(--text-disabled)]">No nutrition logs yet.</p>
      )}
      <div className="flex flex-col gap-2">
        {logs.map(log => {
          const totals = mealTotals(log)
          return (
            <div key={log.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3">
              <div className="flex items-start gap-3">
                {log.image_url && (
                  <img src={log.image_url} alt="" className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{log.meal_name}</p>
                      <p className="text-xs text-[var(--text-disabled)]">{formatDateTime(log.logged_at)}</p>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] whitespace-nowrap">{Math.round(totals.calories)} kcal</p>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--text-disabled)]">
                    P {formatNumber(totals.protein)}g · C {formatNumber(totals.carbs)}g · F {formatNumber(totals.fat)}g
                  </p>
                  {(log.meal_log_foods ?? []).length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {(log.meal_log_foods ?? []).map(food => (
                        <div key={food.id} className="flex justify-between gap-3 text-[11px]">
                          <span className="text-[var(--text-muted)] truncate">{food.name}</span>
                          <span className="text-[var(--text-disabled)] whitespace-nowrap">
                            {formatNumber(food.amount ?? food.amount_grams ?? 0)} {food.unit ?? 'g'} · {Math.round(food.calories)} kcal
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {log.notes && <p className="mt-2 text-xs text-[var(--text-disabled)]">{log.notes}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user: adminUser } = useAuth()
  const { notify } = useNotice()

  const { data: user, isLoading, isError, error } = useUser(id!)
  const { data: workoutPlans = [] } = useWorkoutPlans()
  const { data: mealPlans = [] } = useMealPlans()
  const { data: userMealPlanId } = useUserMealPlan(id!)
  const { data: userWorkoutPlanIds = [] } = useUserWorkoutPlans(id!)
  const { data: weightHistory = [] } = useWeightHistory(id!)
  const { data: compliance } = useUserCompliance(id!)
  const { data: onboarding } = useOnboardingResponse(id!)
  const workoutLogs = useRecentWorkoutLogs(id!)
  const mealLogs = useRecentMealLogs(id!)
  const { data: workoutFeedback = [] } = useWorkoutFeedback(id!)

  const manageAccount = useMutation({
    mutationFn: async (action: AccountAction) => {
      const { data, error } = await supabase.functions.invoke<ManageUserResponse>('admin-manage-user', {
        body: { action, userId: id! },
      })
      if (error) throw error
      if (data?.action !== action || data.userId !== id) throw new Error('The server returned an unexpected response')
    },
    onSuccess: async (_, action) => {
      await qc.invalidateQueries({ queryKey: ['admin-users'] })
      if (action === 'delete') navigate('/admin/users', { replace: true })
      else await qc.invalidateQueries({ queryKey: ['user', id] })
      notify(ACCOUNT_ACTION_COPY[action].success, 'success')
    },
    onError: error => notify(`Couldn’t update this account: ${error.message}`, 'error'),
  })

  const addWorkoutFeedback = useMutation({
    mutationFn: async ({ target, body }: { target: FeedbackTarget; body: string }) => {
      if (!adminUser?.id) throw new Error('Admin session is missing')

      const { error } = await supabase
        .from('workout_feedback')
        .insert({
          user_id: id!,
          coach_id: adminUser.id,
          body,
          workout_log_id: target.type === 'workout' ? target.id : null,
          exercise_log_id: target.type === 'exercise' ? target.id : null,
        })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-workout-feedback', id] })
      notify('Feedback sent to athlete.')
    },
    onError: error => notify(`Couldn’t add feedback: ${error.message}`, 'error'),
  })

  const deleteWorkoutFeedback = useMutation({
    mutationFn: async (feedbackId: string) => {
      const { error } = await supabase.from('workout_feedback').delete().eq('id', feedbackId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-workout-feedback', id] })
      notify('Feedback deleted.')
    },
    onError: error => notify(`Couldn’t delete feedback: ${error.message}`, 'error'),
  })

  function Field({ label, value }: { label: string; value: string | number | null }) {
    return (
      <div>
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
        <p className="text-sm text-text-primary">{value ?? '—'}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <EditorPage backTo="/admin/users" backLabel="Back to users" eyebrow="User profile" title="Loading user…">
        <Shimmer className="h-96 w-full" />
      </EditorPage>
    )
  }

  if (isError || !user) {
    return (
      <EditorPage backTo="/admin/users" backLabel="Back to users" eyebrow="User profile" title="User unavailable">
        <EmptyState
          title="This user couldn’t be loaded"
          description={error?.message ?? 'The account may no longer exist or you may not have access.'}
          action={<Button variant="ghost" onClick={() => navigate('/admin/users')}>Back to users</Button>}
        />
      </EditorPage>
    )
  }

  const isSelf = user.id === adminUser?.id
  const userDisplayName = user.full_name ?? user.email

  return (
    <EditorPage
      backTo="/admin/users"
      backLabel="Back to users"
      eyebrow={user.is_admin ? 'Admin + user profile' : 'Athlete profile'}
      title={user.full_name ?? user.email}
      description={user.email}
      actions={
        <>
          <Badge status={deriveStatus(user)} />
          {!isSelf && <Button variant="ghost" onClick={() => navigate(`/admin/chat?user=${user.id}`)}>Message user</Button>}
        </>
      }
      aside={
        <>
          <Card>
            <h2 className="mb-4 text-sm font-bold text-text-primary">Last 7 days</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-extrabold text-text-primary">{compliance?.workoutsCompleted ?? 0}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-text-secondary">Workouts</p>
              </div>
              <div className="border-x border-outline-subtle px-2">
                <p className="text-2xl font-extrabold text-text-primary">{compliance?.avgCalories ?? 0}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-text-secondary">Avg kcal</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-text-primary">{compliance?.avgProtein ?? 0}g</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-text-secondary">Avg protein</p>
              </div>
            </div>
          </Card>

          {onboarding && (
            <Card>
              <h2 className="mb-4 text-sm font-bold text-text-primary">Onboarding</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Field label="Gender" value={onboarding.gender} />
                <Field label="Goal" value={onboarding.goal ? GOAL_LABELS[onboarding.goal] : null} />
                <Field label="Experience" value={onboarding.experience_level ? EXPERIENCE_LABELS[onboarding.experience_level] : null} />
                <Field label="Equipment" value={onboarding.equipment ? EQUIPMENT_LABELS[onboarding.equipment] : null} />
                <Field label="Frequency" value={onboarding.frequency_per_week ? `${onboarding.frequency_per_week}× / week` : null} />
                <Field label="Training" value={onboarding.training_preference ? TRAINING_LABELS[onboarding.training_preference] : null} />
                <Field label="BMI" value={onboarding.bmi ? onboarding.bmi.toFixed(1) : null} />
                <Field label="Completed" value={onboarding.completed_at ? new Date(onboarding.completed_at).toLocaleDateString() : null} />
              </div>
              {onboarding.focus_areas?.length > 0 && (
                <div className="mt-5 border-t border-outline-subtle pt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Focus areas</p>
                  <BodyFocusMap focusAreas={onboarding.focus_areas} />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {onboarding.focus_areas.map(area => (
                      <span key={area} className="rounded-full border border-outline bg-surface px-2.5 py-1 text-[11px] text-text-secondary">{area}</span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {weightHistory.length > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-bold text-text-primary">Weight history</h2>
              <div className="divide-y divide-outline-subtle">
                {weightHistory.map(entry => (
                  <div key={entry.id} className="flex justify-between gap-3 py-2 text-xs">
                    <span className="text-text-secondary">{entry.recorded_at}</span>
                    <span className="font-semibold text-text-primary">{entry.weight_kg} kg</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {!isSelf && !user.is_admin && (
            <AccountAccessControls
              userName={userDisplayName}
              isBlocked={user.is_blocked}
              pending={manageAccount.isPending}
              onConfirm={manageAccount.mutateAsync}
            />
          )}
        </>
      }
    >
      <AthleteManagementPanel
        user={user}
        mealPlans={mealPlans}
        workoutPlans={workoutPlans}
        currentMealPlanId={userMealPlanId}
        currentWorkoutIds={userWorkoutPlanIds}
      />

      <Card>
        <WorkoutLogsSection
          logs={workoutLogs.data ?? []}
          isLoading={workoutLogs.isLoading}
          error={workoutLogs.error}
          feedback={workoutFeedback}
          onAddFeedback={(target, body) => addWorkoutFeedback.mutate({ target, body })}
          onDeleteFeedback={feedbackId => deleteWorkoutFeedback.mutate(feedbackId)}
          isFeedbackPending={addWorkoutFeedback.isPending || deleteWorkoutFeedback.isPending}
        />
      </Card>

      <Card>
        <MealLogsSection
          logs={mealLogs.data ?? []}
          isLoading={mealLogs.isLoading}
          error={mealLogs.error}
        />
      </Card>

      <Card>
        <CheckInsSection userId={id!} adminUserId={adminUser?.id} />
      </Card>
    </EditorPage>
  )
}
