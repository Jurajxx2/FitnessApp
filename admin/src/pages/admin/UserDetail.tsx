// admin/src/pages/admin/UserDetail.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { SlideOver, Button, Input, Badge } from '../../components/ui'
import type { Profile, Workout, WeightEntry, MealPlan, OnboardingResponse } from '../../types/database'

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
      const { data } = await supabase.from('workouts').select('id, name').order('name')
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
        log.meal_log_foods.forEach((f: any) => {
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
      const { data } = await supabase.from('meal_plans').select('id, name').order('name')
      return data ?? []
    },
  })
}

function useUserMealPlan(userId: string) {
  return useQuery<string | null>({
    queryKey: ['user-meal-plan', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_meal_plans')
        .select('meal_plan_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
      return data?.meal_plan_id ?? null
    },
  })
}

function useUserWorkoutPlan(userId: string) {
  return useQuery<string | null>({
    queryKey: ['user-workout-plan', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_workouts')
        .select('workout_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
      return data?.workout_id ?? null
    },
  })
}

const GOAL_LABELS: Record<string, string> = {
  build_muscle: 'Build muscle',
  lose_weight: 'Lose weight',
  stay_fit: 'Stay fit',
  get_stronger: 'Get stronger',
}
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary', lightly_active: 'Lightly active',
  moderately_active: 'Moderately active', active: 'Active', very_active: 'Very active',
}

function deriveStatus(p: Profile): 'active' | 'inactive' | 'blocked' {
  if (p.is_blocked) return 'blocked'
  if (!p.onboarding_complete) return 'inactive'
  return 'active'
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: user, isLoading } = useUser(id!)
  const { data: workoutPlans = [] } = useWorkoutPlans()
  const { data: mealPlans = [] } = useMealPlans()
  const { data: userMealPlanId } = useUserMealPlan(id!)
  const { data: userWorkoutPlanId } = useUserWorkoutPlan(id!)
  const { data: weightHistory = [] } = useWeightHistory(id!)
  const { data: compliance } = useUserCompliance(id!)
  const { data: onboarding } = useOnboardingResponse(id!)

  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (user?.admin_notes) {
      setAdminNotes(user.admin_notes)
    }
  }, [user?.admin_notes])

  const updateProfile = useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', id] }),
  })

  const assignMealPlan = useMutation({
    mutationFn: async (mealPlanId: string | null) => {
      await supabase.from('user_meal_plans').delete().eq('user_id', id!)
      if (mealPlanId) {
        const { error } = await supabase
          .from('user_meal_plans')
          .insert({ user_id: id!, meal_plan_id: mealPlanId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-meal-plan', id] })
      qc.invalidateQueries({ queryKey: ['meal-plan-assignment-counts'] })
    },
  })

  const assignWorkoutPlan = useMutation({
    mutationFn: async (workoutId: string | null) => {
      await supabase.from('user_workouts').delete().eq('user_id', id!)
      if (workoutId) {
        const { error } = await supabase
          .from('user_workouts')
          .insert({ user_id: id!, workout_id: workoutId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-workout-plan', id] })
    },
  })

  function Field({ label, value }: { label: string; value: string | number | null }) {
    return (
      <div>
        <p className="text-[10px] text-[var(--text-disabled)] uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm text-[var(--text)]">{value ?? '—'}</p>
      </div>
    )
  }

  if (isLoading || !user) {
    return (
      <SlideOver open title="User Detail" onClose={() => navigate('/admin/users')}>
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
      </SlideOver>
    )
  }

  return (
    <SlideOver open title={user.full_name ?? user.email} onClose={() => navigate('/admin/users')}>
      <div className="flex flex-col gap-6">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge status={deriveStatus(user)} />
        </div>

        {/* Compliance Dashboard */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-[10px] text-[var(--text-disabled)] uppercase mb-1">Workouts</p>
            <p className="text-lg font-bold text-[var(--text)]">{compliance?.workoutsCompleted ?? 0}</p>
            <p className="text-[10px] text-[var(--text-muted)]">last 7d</p>
          </div>
          <div className="text-center border-x border-[var(--border)]">
            <p className="text-[10px] text-[var(--text-disabled)] uppercase mb-1">Avg kcal</p>
            <p className="text-lg font-bold text-[var(--text)]">{compliance?.avgCalories ?? 0}</p>
            <p className="text-[10px] text-[var(--text-muted)]">daily</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[var(--text-disabled)] uppercase mb-1">Avg prot</p>
            <p className="text-lg font-bold text-[var(--text)]">{compliance?.avgProtein ?? 0}g</p>
            <p className="text-[10px] text-[var(--text-muted)]">daily</p>
          </div>
        </div>

        {/* Profile info */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Full name"  value={user.full_name} />
          <Field label="Email"      value={user.email} />
          <Field label="Age"        value={user.age} />
          <Field label="Height"     value={user.height_cm ? `${user.height_cm} cm` : null} />
          <Field label="Weight"     value={user.weight_kg ? `${user.weight_kg} kg` : null} />
          <Field label="Goal"       value={user.goal ? GOAL_LABELS[user.goal] : null} />
          <Field label="Activity"   value={user.activity_level ? ACTIVITY_LABELS[user.activity_level] : null} />
          <Field label="Joined"     value={new Date(user.created_at).toLocaleDateString()} />
          <Field label="Onboarding" value={user.onboarding_complete ? 'Complete' : 'Incomplete'} />
        </div>

        {/* Onboarding quiz */}
        {onboarding && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Onboarding Quiz</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Gender"     value={onboarding.gender} />
              <Field label="Goal"       value={onboarding.goal ? GOAL_LABELS[onboarding.goal] : null} />
              <Field label="Experience" value={onboarding.experience_level ? EXPERIENCE_LABELS[onboarding.experience_level] : null} />
              <Field label="Equipment"  value={onboarding.equipment ? EQUIPMENT_LABELS[onboarding.equipment] : null} />
              <Field label="Frequency"  value={onboarding.frequency_per_week ? `${onboarding.frequency_per_week}× / week` : null} />
              <Field label="Training"   value={onboarding.training_preference ? TRAINING_LABELS[onboarding.training_preference] : null} />
              <Field label="BMI"        value={onboarding.bmi ? onboarding.bmi.toFixed(1) : null} />
              <Field label="Completed"  value={onboarding.completed_at ? new Date(onboarding.completed_at).toLocaleDateString() : null} />
            </div>
            {onboarding.focus_areas?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {onboarding.focus_areas.map(a => (
                  <span key={a} className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)]">{a}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assign Meal Plan */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Meal Plan</p>
          <select
            className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none"
            value={userMealPlanId ?? ''}
            onChange={e => assignMealPlan.mutate(e.target.value || null)}
            disabled={assignMealPlan.isPending}
          >
            <option value="">None</option>
            {mealPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Assign Workout Plan */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Workout Plan</p>
          <select
            className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none"
            value={userWorkoutPlanId ?? ''}
            onChange={e => assignWorkoutPlan.mutate(e.target.value || null)}
            disabled={assignWorkoutPlan.isPending}
          >
            <option value="">None</option>
            {workoutPlans.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Weight history */}
        {weightHistory.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Weight History</p>
            <div className="flex flex-col gap-1">
              {weightHistory.map(e => (
                <div key={e.id} className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{e.recorded_at}</span>
                  <span className="text-[var(--text)] font-semibold">{e.weight_kg} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin notes */}
        <div>
          <Input
            label="Admin Notes"
            value={adminNotes || user.admin_notes || ''}
            onChange={e => setAdminNotes(e.target.value)}
            placeholder="Private notes about this user…"
          />
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => updateProfile.mutate({ admin_notes: adminNotes })}
            loading={updateProfile.isPending}
          >
            Save notes
          </Button>
        </div>

        {/* Block / Unblock */}
        <Button
          variant={user.is_blocked ? 'ghost' : 'danger'}
          className="w-full"
          onClick={() => updateProfile.mutate({ is_blocked: !user.is_blocked })}
          loading={updateProfile.isPending}
        >
          {user.is_blocked ? 'Unblock user' : 'Block user'}
        </Button>
      </div>
    </SlideOver>
  )
}
