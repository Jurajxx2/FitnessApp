import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, useNotice } from '../../components/ui'
import { calcMacroTargets } from '../../nutrition/calc'
import { supabase } from '../../lib/supabase'
import type { AccessMode, MealPlan, NutritionTarget, Profile, Workout } from '../../types/database'

type PlanOption = Pick<MealPlan, 'id' | 'name'>
type WorkoutOption = Pick<Workout, 'id' | 'name'>

interface AthleteManagementPanelProps {
  user: Profile
  mealPlans: PlanOption[]
  workoutPlans: WorkoutOption[]
  currentMealPlanId: string | null | undefined
  currentWorkoutIds: string[]
}

interface ProfileDraft {
  fullName: string
  age: string
  heightCm: string
  weightKg: string
  goal: string
  activityLevel: string
  onboardingComplete: boolean
  accessMode: AccessMode
  adminNotes: string
}

interface MacroDraft {
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
  fiberGMin: string
}

function optionalNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value)
}

function profileDraft(user: Profile): ProfileDraft {
  return {
    fullName: user.full_name ?? '',
    age: user.age == null ? '' : String(user.age),
    heightCm: user.height_cm == null ? '' : String(user.height_cm),
    weightKg: user.weight_kg == null ? '' : String(user.weight_kg),
    goal: user.goal ?? '',
    activityLevel: user.activity_level ?? '',
    onboardingComplete: user.onboarding_complete,
    accessMode: user.access_mode ?? 'both',
    adminNotes: user.admin_notes ?? '',
  }
}

function macroDraft(target: NutritionTarget | null | undefined): MacroDraft {
  return {
    calories: target ? String(Math.round(target.calories)) : '',
    proteinG: target ? String(Math.round(target.protein_g)) : '',
    carbsG: target ? String(Math.round(target.carbs_g)) : '',
    fatG: target ? String(Math.round(target.fat_g)) : '',
    fiberGMin: target?.fiber_g_min == null ? '' : String(Math.round(target.fiber_g_min)),
  }
}

function useActiveNutritionTarget(userId: string) {
  return useQuery<NutritionTarget | null>({
    queryKey: ['admin-nutrition-target', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_nutrition_target', { p_user_id: userId })
      if (error) throw error
      return (data as NutritionTarget[] | null)?.[0] ?? null
    },
  })
}

const ACCESS_OPTIONS: Array<{ value: AccessMode; label: string; description: string }> = [
  { value: 'both', label: 'Nutrition + activity', description: 'Full athlete experience.' },
  { value: 'nutrition', label: 'Nutrition only', description: 'Meals, recipes, hydration, and nutrition history.' },
  { value: 'activity', label: 'Activity only', description: 'Workouts, exercise library, progress, and activity history.' },
]

export function AthleteManagementPanel({
  user,
  mealPlans,
  workoutPlans,
  currentMealPlanId,
  currentWorkoutIds,
}: AthleteManagementPanelProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const targetQuery = useActiveNutritionTarget(user.id)
  const [profile, setProfile] = useState<ProfileDraft>(() => profileDraft(user))
  const [macros, setMacros] = useState<MacroDraft>(() => macroDraft(null))
  const [mealPlanId, setMealPlanId] = useState('')
  const [workoutIds, setWorkoutIds] = useState<string[]>([])

  useEffect(() => setProfile(profileDraft(user)), [user])
  useEffect(() => setMacros(macroDraft(targetQuery.data)), [targetQuery.data])
  useEffect(() => setMealPlanId(currentMealPlanId ?? ''), [currentMealPlanId])
  useEffect(() => {
    const availableIds = new Set(workoutPlans.map(workout => workout.id))
    setWorkoutIds(currentWorkoutIds.filter(workoutId => availableIds.has(workoutId)))
  }, [currentWorkoutIds, workoutPlans])

  const macroValues = useMemo(() => ({
    calories: Number(macros.calories),
    proteinG: Number(macros.proteinG),
    carbsG: Number(macros.carbsG),
    fatG: Number(macros.fatG),
    fiberGMin: optionalNumber(macros.fiberGMin),
  }), [macros])
  const macrosValid = macroValues.calories > 0
    && macroValues.proteinG >= 0
    && macroValues.carbsG >= 0
    && macroValues.fatG >= 0
    && (macroValues.fiberGMin == null || macroValues.fiberGMin >= 0)
  const currentMealPlanUnavailable = Boolean(currentMealPlanId && !mealPlans.some(plan => plan.id === currentMealPlanId))

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_update_athlete_profile', {
        p_user_id: user.id,
        p_full_name: profile.fullName,
        p_age: optionalNumber(profile.age),
        p_height_cm: optionalNumber(profile.heightCm),
        p_weight_kg: optionalNumber(profile.weightKg),
        p_goal: profile.goal || null,
        p_activity_level: profile.activityLevel || null,
        p_onboarding_complete: profile.onboardingComplete,
        p_access_mode: profile.accessMode,
        p_admin_notes: profile.adminNotes,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', user.id] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      notify('Athlete profile and access updated.')
    },
    onError: error => notify(`Couldn’t update athlete: ${error.message}`, 'error'),
  })

  const saveMacros = useMutation({
    mutationFn: async () => {
      if (!macrosValid) throw new Error('Enter a positive calorie goal and non-negative macro goals')
      const { error } = await supabase.from('nutrition_targets').insert({
        user_id: user.id,
        source: 'admin',
        calories: macroValues.calories,
        protein_g: macroValues.proteinG,
        carbs_g: macroValues.carbsG,
        fat_g: macroValues.fatG,
        fiber_g_min: macroValues.fiberGMin,
        is_locked: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-nutrition-target', user.id] })
      queryClient.invalidateQueries({ queryKey: ['macroTarget', user.id] })
      notify('Coach macro goals saved as a new version.')
    },
    onError: error => notify(`Couldn’t save macro goals: ${error.message}`, 'error'),
  })

  const saveMealPlan = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_set_user_meal_plan', {
        p_user_id: user.id,
        p_meal_plan_id: mealPlanId || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-meal-plan', user.id] })
      queryClient.invalidateQueries({ queryKey: ['meal-plan-assignment-counts'] })
      notify(mealPlanId ? 'Meal plan assigned.' : 'Meal plan unassigned.')
    },
    onError: error => notify(`Couldn’t update meal plan: ${error.message}`, 'error'),
  })

  const saveWorkouts = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_set_user_workouts', {
        p_user_id: user.id,
        p_workout_ids: workoutIds,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workout-plans', user.id] })
      notify('Workout assignments updated.')
    },
    onError: error => notify(`Couldn’t update workouts: ${error.message}`, 'error'),
  })

  function calculateFromProfile() {
    const calculated = calcMacroTargets({
      weight_kg: optionalNumber(profile.weightKg),
      height_cm: optionalNumber(profile.heightCm),
      age: optionalNumber(profile.age),
      goal: (profile.goal || null) as Profile['goal'],
      activity_level: (profile.activityLevel || null) as Profile['activity_level'],
      gender: user.gender ?? null,
    })
    if (!calculated) {
      notify('Age, height, weight, and activity level are required before macros can be calculated.', 'error')
      return
    }
    setMacros({
      calories: String(Math.round(calculated.calories)),
      proteinG: String(Math.round(calculated.protein_g)),
      carbsG: String(Math.round(calculated.carbs_g)),
      fatG: String(Math.round(calculated.fat_g)),
      fiberGMin: macros.fiberGMin,
    })
  }

  function toggleWorkout(workoutId: string) {
    setWorkoutIds(current => current.includes(workoutId)
      ? current.filter(id => id !== workoutId)
      : [...current, workoutId]
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="xl:col-span-2">
        <div className="mb-5">
          <h2 className="text-base font-bold text-text-primary">Athlete profile and access</h2>
          <p className="mt-1 text-sm text-text-secondary">Edit coach-managed profile fields and decide which athlete areas are available.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Full name" value={profile.fullName} onChange={event => setProfile(current => ({ ...current, fullName: event.target.value }))} />
          <Input label="Account email" value={user.email} disabled />
          <Input label="Age" type="number" min="13" max="120" value={profile.age} onChange={event => setProfile(current => ({ ...current, age: event.target.value }))} />
          <Input label="Height (cm)" type="number" min="50" max="260" step="0.1" value={profile.heightCm} onChange={event => setProfile(current => ({ ...current, heightCm: event.target.value }))} />
          <Input label="Weight (kg)" type="number" min="20" max="500" step="0.1" value={profile.weightKg} onChange={event => setProfile(current => ({ ...current, weightKg: event.target.value }))} />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Goal</label>
            <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary" value={profile.goal} onChange={event => setProfile(current => ({ ...current, goal: event.target.value }))}>
              <option value="">Not set</option><option value="lose_weight">Lose weight</option><option value="build_muscle">Build muscle</option><option value="get_stronger">Get stronger</option><option value="stay_fit">Stay fit</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Activity level</label>
            <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary" value={profile.activityLevel} onChange={event => setProfile(current => ({ ...current, activityLevel: event.target.value }))}>
              <option value="">Not set</option><option value="sedentary">Sedentary</option><option value="lightly_active">Lightly active</option><option value="moderately_active">Moderately active</option><option value="active">Active</option><option value="very_active">Very active</option>
            </select>
          </div>
          <label className="flex min-h-10 items-center gap-3 self-end rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary">
            <input type="checkbox" checked={profile.onboardingComplete} onChange={event => setProfile(current => ({ ...current, onboardingComplete: event.target.checked }))} /> Onboarding complete
          </label>
        </div>

        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">Athlete access</p>
          <div className="grid gap-3 md:grid-cols-3">
            {ACCESS_OPTIONS.map(option => (
              <label key={option.value} className={`cursor-pointer rounded-2xl border p-4 ${profile.accessMode === option.value ? 'border-accent bg-accent/5' : 'border-outline-subtle bg-surface'}`}>
                <span className="flex items-center gap-2 text-sm font-semibold text-text-primary"><input type="radio" name="access-mode" value={option.value} checked={profile.accessMode === option.value} onChange={() => setProfile(current => ({ ...current, accessMode: option.value }))} />{option.label}</span>
                <span className="mt-2 block text-xs leading-5 text-text-secondary">{option.description}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Private admin notes</label>
          <textarea className="min-h-24 w-full resize-y rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" value={profile.adminNotes} onChange={event => setProfile(current => ({ ...current, adminNotes: event.target.value }))} placeholder="Context only coaches can see…" />
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending}>Save profile and access</Button></div>
      </Card>

      <Card>
        <h2 className="text-base font-bold text-text-primary">Nutrition goals and meal plan</h2>
        <p className="mt-1 text-sm text-text-secondary">Coach targets override calculated or athlete-entered goals and are versioned.</p>
        {targetQuery.data && <p className="mt-3 text-xs font-semibold text-accent">Active target · version {targetQuery.data.version}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-3">
          <Input label="Calories" type="number" min="1" value={macros.calories} onChange={event => setMacros(current => ({ ...current, calories: event.target.value }))} />
          <Input label="Protein (g)" type="number" min="0" value={macros.proteinG} onChange={event => setMacros(current => ({ ...current, proteinG: event.target.value }))} />
          <Input label="Carbs (g)" type="number" min="0" value={macros.carbsG} onChange={event => setMacros(current => ({ ...current, carbsG: event.target.value }))} />
          <Input label="Fat (g)" type="number" min="0" value={macros.fatG} onChange={event => setMacros(current => ({ ...current, fatG: event.target.value }))} />
          <Input label="Fiber min (g)" type="number" min="0" value={macros.fiberGMin} onChange={event => setMacros(current => ({ ...current, fiberGMin: event.target.value }))} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={calculateFromProfile}>Calculate from profile</Button>
          <Button onClick={() => saveMacros.mutate()} loading={saveMacros.isPending} disabled={!macrosValid}>Save macro goals</Button>
        </div>

        <div className="mt-5 border-t border-outline-subtle pt-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Assigned meal plan</label>
          <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary" value={mealPlanId} onChange={event => setMealPlanId(event.target.value)}>
            <option value="">No meal plan</option>
            {currentMealPlanUnavailable && currentMealPlanId && <option value={currentMealPlanId}>Current generated or unavailable plan</option>}
            {mealPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => saveMealPlan.mutate()} loading={saveMealPlan.isPending} disabled={currentMealPlanUnavailable && mealPlanId === currentMealPlanId}>Save assignment</Button>
            <Button variant="secondary" onClick={() => navigate(`/admin/nutrition/meal-plans/new?user=${user.id}`)} disabled={!targetQuery.data}>Create plan for these macros</Button>
          </div>
          {!targetQuery.data && <p className="mt-2 text-xs text-text-secondary">Save macro goals first to open a target-aware meal-plan editor.</p>}
          {currentMealPlanUnavailable && <p className="mt-2 text-xs text-text-secondary">The current plan is generated, inactive, or unavailable in the manual library. Choose another plan or “No meal plan” to replace it.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-bold text-text-primary">Workout assignments</h2>
        <p className="mt-1 text-sm text-text-secondary">Select every active coach plan this athlete should see.</p>
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
          {workoutPlans.length === 0 ? <p className="text-sm text-text-secondary">No active workout plans are available.</p> : workoutPlans.map(workout => (
            <label key={workout.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-subtle bg-surface px-3 py-2.5 text-sm text-text-primary">
              <input type="checkbox" checked={workoutIds.includes(workout.id)} onChange={() => toggleWorkout(workout.id)} />
              <span className="font-medium">{workout.name}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => saveWorkouts.mutate()} loading={saveWorkouts.isPending}>Save workouts</Button>
          <Button variant="ghost" onClick={() => navigate(`/admin/workouts/new?user=${user.id}`)}>Create workout for athlete</Button>
        </div>
      </Card>
    </div>
  )
}
