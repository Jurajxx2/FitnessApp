// admin/src/pages/admin/UserDetail.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Badge, Button, Card, ConfirmDialog, DataTable, EditorPage, EmptyState, Shimmer, SlideOver, useNotice } from '../../components/ui'
import type { DataColumn } from '../../components/ui'
import { BodyFocusMap } from '../../components/BodyFocusMap'
import { MealPhoto } from '../../components/MealPhoto'
import { CheckInsSection } from './CheckInsSection'
import { AthleteManagementPanel } from './AthleteManagementPanel'
import { PROFILE_SELECT } from '../../profile/selects'
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

interface AccountActionIntent {
  action: AccountAction
  targetUserId: string
  requestId: string
}

export function accountActionIntent(
  current: AccountActionIntent | null,
  action: AccountAction,
  targetUserId: string,
  createRequestId = () => crypto.randomUUID(),
): AccountActionIntent {
  if (current?.action === action && current.targetUserId === targetUserId) return current
  return { action, targetUserId, requestId: createRequestId() }
}

export function clearAccountActionIntent(
  current: AccountActionIntent | null,
  resolvedRequestId: string,
): AccountActionIntent | null {
  return current?.requestId === resolvedRequestId ? null : current
}

export function isTerminalAccountActionError(response?: Response): boolean {
  return response !== undefined && response.status >= 400 && response.status < 500 && response.status !== 408
}

type ManageUserResponse =
  | { action: AccountAction; userId: string }
  | { status: 'pending'; error: string; requestId: string }

export function accountActionMatchesProfile(action: AccountAction, profile: Profile | undefined): boolean {
  if (!profile) return false
  if (action === 'block') return profile.is_blocked
  if (action === 'unblock') return !profile.is_blocked
  if (action === 'promote_admin') return profile.is_admin && !profile.is_blocked
  return false
}

export async function reconcilePendingAccountAction(
  queryClient: Pick<QueryClient, 'invalidateQueries' | 'getQueryData'>,
  action: AccountAction,
  targetUserId: string,
): Promise<boolean> {
  try {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      queryClient.invalidateQueries({ queryKey: ['user', targetUserId] }),
    ])
  } catch {
    return false
  }
  return accountActionMatchesProfile(action, queryClient.getQueryData<Profile>(['user', targetUserId]))
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
          <Button variant="danger" className="w-full" disabled title="Deletion will be enabled with retryable storage cleanup.">
            Delete user (temporarily unavailable)
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
      const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

export function useAthleteAdminNote(id: string) {
  return useQuery<string>({
    queryKey: ['athlete-admin-note', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athlete_admin_notes')
        .select('notes')
        .eq('profile_id', id)
        .maybeSingle()
      if (error) throw error
      return data?.notes ?? ''
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

export function useRecentWorkoutLogs(userId: string) {
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

export function useRecentMealLogs(userId: string) {
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

interface LogPage<T> {
  data: T[]
  count: number
}

// Separate, page-aware counterpart to useRecentWorkoutLogs. Fetches lazily
// (only once the "View all" panel is open) and never touches the 5-row
// preview's query key or cache entry.
function useWorkoutLogsHistory(userId: string, page: number, pageSize: number, enabled: boolean) {
  return useQuery<LogPage<WorkoutLogWithExercises>>({
    queryKey: ['user-workout-logs-history', userId, page, pageSize],
    enabled,
    queryFn: async () => {
      const { data, count, error } = await supabase
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
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .order('id')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (error) throw error
      return { data: (data ?? []) as unknown as WorkoutLogWithExercises[], count: count ?? 0 }
    },
  })
}

// Separate, page-aware counterpart to useRecentMealLogs — see useWorkoutLogsHistory.
function useMealLogsHistory(userId: string, page: number, pageSize: number, enabled: boolean) {
  return useQuery<LogPage<MealLogWithFoods>>({
    queryKey: ['user-meal-logs-history', userId, page, pageSize],
    enabled,
    queryFn: async () => {
      const { data, count, error } = await supabase
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
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .order('id')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (error) throw error
      return { data: (data ?? []) as unknown as MealLogWithFoods[], count: count ?? 0 }
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

export function WorkoutLogsSection({
  logs,
  isLoading,
  error,
  feedback,
  onAddFeedback,
  onDeleteFeedback,
  isFeedbackPending,
  onViewAll,
}: {
  logs: WorkoutLogWithExercises[]
  isLoading: boolean
  error: Error | null
  feedback: WorkoutFeedback[]
  onAddFeedback: (target: FeedbackTarget, body: string) => void
  onDeleteFeedback: (id: string) => void
  isFeedbackPending: boolean
  onViewAll: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Recent Workout Logs</SectionTitle>
        <button
          type="button"
          className="mb-2 cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-text-secondary hover:text-text-primary"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>
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

export function MealLogsSection({
  logs,
  isLoading,
  error,
  onViewAll,
}: {
  logs: MealLogWithFoods[]
  isLoading: boolean
  error: Error | null
  onViewAll: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Recent Nutrition Logs</SectionTitle>
        <button
          type="button"
          className="mb-2 cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-text-secondary hover:text-text-primary"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>
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
                  <MealPhoto path={log.image_url} alt="" className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
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

const HISTORY_PAGE_SIZE = 20

export function WorkoutLogsHistorySlideOver({
  userId,
  open,
  onClose,
}: {
  userId: string
  open: boolean
  onClose: () => void
}) {
  const [page, setPage] = useState(0)
  const { data, isLoading } = useWorkoutLogsHistory(userId, page, HISTORY_PAGE_SIZE, open)
  const logs = data?.data ?? []
  const totalItems = data?.count ?? 0

  const columns: DataColumn<WorkoutLogWithExercises>[] = [
    { key: 'date', header: 'Date', render: log => formatDateTime(log.logged_at) },
    { key: 'workout', header: 'Workout', className: 'text-text-primary', render: log => log.workout_name },
    { key: 'duration', header: 'Duration', render: log => `${log.duration_minutes} min` },
    { key: 'sets', header: 'Sets', render: log => `${workoutTotals(log).sets}` },
    { key: 'volume', header: 'Volume', render: log => `${formatNumber(workoutTotals(log).volumeKg)} kg` },
  ]

  return (
    <SlideOver open={open} onClose={onClose} title="All workout logs">
      <DataTable<WorkoutLogWithExercises>
        rows={logs}
        getRowId={log => log.id}
        columns={columns}
        serverPagination
        page={page}
        pageSize={HISTORY_PAGE_SIZE}
        totalItems={totalItems}
        pageSizeOptions={[HISTORY_PAGE_SIZE]}
        onPageChange={setPage}
        onPageSizeChange={() => {}}
        loading={isLoading}
        empty={<EmptyState title="No workout logs yet" description="Logs will appear here once the athlete records a workout." />}
      />
    </SlideOver>
  )
}

export function MealLogsHistorySlideOver({
  userId,
  open,
  onClose,
}: {
  userId: string
  open: boolean
  onClose: () => void
}) {
  const [page, setPage] = useState(0)
  const { data, isLoading } = useMealLogsHistory(userId, page, HISTORY_PAGE_SIZE, open)
  const logs = data?.data ?? []
  const totalItems = data?.count ?? 0

  const columns: DataColumn<MealLogWithFoods>[] = [
    { key: 'date', header: 'Date', render: log => formatDateTime(log.logged_at) },
    { key: 'meal', header: 'Meal', className: 'text-text-primary', render: log => log.meal_name },
    { key: 'calories', header: 'Calories', render: log => `${Math.round(mealTotals(log).calories)} kcal` },
    { key: 'protein', header: 'Protein', render: log => `${formatNumber(mealTotals(log).protein)}g` },
    { key: 'carbs', header: 'Carbs', render: log => `${formatNumber(mealTotals(log).carbs)}g` },
    { key: 'fat', header: 'Fat', render: log => `${formatNumber(mealTotals(log).fat)}g` },
  ]

  return (
    <SlideOver open={open} onClose={onClose} title="All nutrition logs">
      <DataTable<MealLogWithFoods>
        rows={logs}
        getRowId={log => log.id}
        columns={columns}
        serverPagination
        page={page}
        pageSize={HISTORY_PAGE_SIZE}
        totalItems={totalItems}
        pageSizeOptions={[HISTORY_PAGE_SIZE]}
        onPageChange={setPage}
        onPageSizeChange={() => {}}
        loading={isLoading}
        empty={<EmptyState title="No nutrition logs yet" description="Logs will appear here once the athlete records a meal." />}
      />
    </SlideOver>
  )
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user: adminUser } = useAuth()
  const { notify } = useNotice()

  const { data: user, isLoading, isError, error } = useUser(id!)
  const adminNoteQuery = useAthleteAdminNote(id!)
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
  const [showAllWorkoutLogs, setShowAllWorkoutLogs] = useState(false)
  const [showAllMealLogs, setShowAllMealLogs] = useState(false)
  const accountActionIntentRef = useRef<AccountActionIntent | null>(null)

  const manageAccount = useMutation({
    mutationFn: async (action: AccountAction) => {
      const intent = accountActionIntent(accountActionIntentRef.current, action, id!)
      accountActionIntentRef.current = intent
      const { data, error, response } = await supabase.functions.invoke<ManageUserResponse>('admin-manage-user', {
        body: { action, userId: id! },
        headers: { 'x-request-id': intent.requestId },
      })
      if (error) {
        if (isTerminalAccountActionError(response)) {
          accountActionIntentRef.current = clearAccountActionIntent(accountActionIntentRef.current, intent.requestId)
          if (response?.status === 409) {
            await Promise.all([
              qc.invalidateQueries({ queryKey: ['admin-users'] }),
              qc.invalidateQueries({ queryKey: ['user', id] }),
            ]).catch(() => {})
          }
        }
        throw error
      }
      if (data && 'status' in data && data.status === 'pending') {
        if (await reconcilePendingAccountAction(qc, action, id!)) {
          accountActionIntentRef.current = clearAccountActionIntent(accountActionIntentRef.current, intent.requestId)
          return
        }
        throw new Error('This account action is still being confirmed. Retry safely in a moment.')
      }
      if (!data || !('action' in data) || data.action !== action || data.userId !== id) {
        throw new Error('The server returned an unexpected response')
      }
      accountActionIntentRef.current = clearAccountActionIntent(accountActionIntentRef.current, intent.requestId)
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
                <p className="font-display text-2xl font-extrabold tabular-nums text-text-primary">{compliance?.workoutsCompleted ?? 0}</p>
                <p className="mt-1 ledger-label text-text-secondary">Workouts</p>
              </div>
              <div className="border-x border-outline-subtle px-2">
                <p className="font-display text-2xl font-extrabold tabular-nums text-text-primary">{compliance?.avgCalories ?? 0}</p>
                <p className="mt-1 ledger-label text-text-secondary">Avg kcal</p>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold tabular-nums text-text-primary">{compliance?.avgProtein ?? 0}g</p>
                <p className="mt-1 ledger-label text-text-secondary">Avg protein</p>
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
      {adminNoteQuery.isLoading ? (
        <Shimmer className="h-96 w-full" />
      ) : adminNoteQuery.isError ? (
        <Card>
          <p className="text-sm font-semibold text-error">Coach notes couldn’t be loaded.</p>
          <p className="mt-1 text-xs text-text-secondary">
            Profile editing is paused so an unavailable note cannot be overwritten as empty.
          </p>
          <Button className="mt-4" variant="ghost" onClick={() => { void adminNoteQuery.refetch() }}>
            Retry coach notes
          </Button>
        </Card>
      ) : (
        <AthleteManagementPanel
          user={user}
          adminNotes={adminNoteQuery.data ?? ''}
          mealPlans={mealPlans}
          workoutPlans={workoutPlans}
          currentMealPlanId={userMealPlanId}
          currentWorkoutIds={userWorkoutPlanIds}
        />
      )}

      <Card>
        <WorkoutLogsSection
          logs={workoutLogs.data ?? []}
          isLoading={workoutLogs.isLoading}
          error={workoutLogs.error}
          feedback={workoutFeedback}
          onAddFeedback={(target, body) => addWorkoutFeedback.mutate({ target, body })}
          onDeleteFeedback={feedbackId => deleteWorkoutFeedback.mutate(feedbackId)}
          isFeedbackPending={addWorkoutFeedback.isPending || deleteWorkoutFeedback.isPending}
          onViewAll={() => setShowAllWorkoutLogs(true)}
        />
      </Card>

      <Card>
        <MealLogsSection
          logs={mealLogs.data ?? []}
          isLoading={mealLogs.isLoading}
          error={mealLogs.error}
          onViewAll={() => setShowAllMealLogs(true)}
        />
      </Card>

      <Card>
        <CheckInsSection userId={id!} adminUserId={adminUser?.id} />
      </Card>

      <WorkoutLogsHistorySlideOver userId={id!} open={showAllWorkoutLogs} onClose={() => setShowAllWorkoutLogs(false)} />
      <MealLogsHistorySlideOver userId={id!} open={showAllMealLogs} onClose={() => setShowAllMealLogs(false)} />
    </EditorPage>
  )
}
