import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, useNotice } from '../../components/ui'
import { NutritionPreferencesForm } from '../../components/NutritionPreferencesForm'
import { calcMacroTargets } from '../../nutrition/calc'
import { defaultPreferences, useNutritionPreferences, useSaveNutritionPreferences } from '../../nutrition/preferences'
import { supabase } from '../../lib/supabase'
import type { AccessMode, MealPlan, NutritionTarget, Profile, UserNutritionPreferences, Workout } from '../../types/database'

type PlanOption = Pick<MealPlan, 'id' | 'name'>
type WorkoutOption = Pick<Workout, 'id' | 'name'>

interface AthleteManagementPanelProps {
  user: Profile
  adminNotes: string
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
  calorieTolPct: string
  proteinTolPct: string
  carbsTolPct: string
  fatTolPct: string
}

function optionalNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value)
}

function profileDraft(user: Profile, adminNotes: string): ProfileDraft {
  return {
    fullName: user.full_name ?? '',
    age: user.age == null ? '' : String(user.age),
    heightCm: user.height_cm == null ? '' : String(user.height_cm),
    weightKg: user.weight_kg == null ? '' : String(user.weight_kg),
    goal: user.goal ?? '',
    activityLevel: user.activity_level ?? '',
    onboardingComplete: user.onboarding_complete,
    accessMode: user.access_mode ?? 'both',
    adminNotes,
  }
}

function macroDraft(target: NutritionTarget | null | undefined): MacroDraft {
  return {
    calories: target ? String(Math.round(target.calories)) : '',
    proteinG: target ? String(Math.round(target.protein_g)) : '',
    carbsG: target ? String(Math.round(target.carbs_g)) : '',
    fatG: target ? String(Math.round(target.fat_g)) : '',
    fiberGMin: target?.fiber_g_min == null ? '' : String(Math.round(target.fiber_g_min)),
    calorieTolPct: String(target?.calorie_tol_pct ?? 5),
    proteinTolPct: String(target?.protein_tol_pct ?? 10),
    carbsTolPct: String(target?.carbs_tol_pct ?? 15),
    fatTolPct: String(target?.fat_tol_pct ?? 15),
  }
}

function requiredNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
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

const SECTION_LABELS = {
  profile: 'User profile and access',
  macros: 'Nutrition goals and meal plan',
  mealPlan: 'Assigned meal plan',
  workouts: 'Workout assignments',
  preferences: 'Nutrition preferences',
} as const

type SectionKey = keyof typeof SECTION_LABELS

// Save order per the plan: profile, macros, meal plan, workouts, preferences.
const SECTION_ORDER: SectionKey[] = ['profile', 'macros', 'mealPlan', 'workouts', 'preferences']

// Deep-equality helper for dirty tracking. Arrays are compared by content
// regardless of order (checkbox/chip toggles rebuild arrays via filter+push,
// so the same selected set can come out in a different order without the
// section actually being "dirty"). Objects are compared key-by-key so a
// freshly-fetched-but-identical object (a new reference from a refetch)
// doesn't read as dirty.
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(normalize)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entryValue]): [string, unknown] => [key, normalize(entryValue)])
        .sort(([a], [b]) => a.localeCompare(b))
    )
  }
  return value
}

function isDirty<T>(current: T, baseline: T): boolean {
  return JSON.stringify(normalize(current)) !== JSON.stringify(normalize(baseline))
}

const ACCESS_OPTIONS: Array<{ value: AccessMode; label: string; description: string }> = [
  { value: 'both', label: 'Nutrition + activity', description: 'Full athlete experience.' },
  { value: 'nutrition', label: 'Nutrition only', description: 'Meals, recipes, hydration, and nutrition history.' },
  { value: 'activity', label: 'Activity only', description: 'Workouts, exercise library, progress, and activity history.' },
]

export function AthleteManagementPanel({
  user,
  adminNotes,
  mealPlans,
  workoutPlans,
  currentMealPlanId,
  currentWorkoutIds,
}: AthleteManagementPanelProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const targetQuery = useActiveNutritionTarget(user.id)
  const [profile, setProfile] = useState<ProfileDraft>(() => profileDraft(user, adminNotes))
  const [profileBaseline, setProfileBaseline] = useState<ProfileDraft>(() => profileDraft(user, adminNotes))
  const [macros, setMacros] = useState<MacroDraft>(() => macroDraft(null))
  const [macrosBaseline, setMacrosBaseline] = useState<MacroDraft>(() => macroDraft(null))
  const [mealPlanId, setMealPlanId] = useState('')
  const [mealPlanBaseline, setMealPlanBaseline] = useState('')
  const [workoutIds, setWorkoutIds] = useState<string[]>([])
  const [workoutIdsBaseline, setWorkoutIdsBaseline] = useState<string[]>([])
  const preferencesQuery = useNutritionPreferences(user.id)
  const savePreferences = useSaveNutritionPreferences(user.id)
  const [preferences, setPreferences] = useState<UserNutritionPreferences>(() => defaultPreferences(user.id))
  const [preferencesBaseline, setPreferencesBaseline] = useState<UserNutritionPreferences>(() => defaultPreferences(user.id))
  useEffect(() => {
    if (!preferencesQuery.data) return
    setPreferences(preferencesQuery.data)
    setPreferencesBaseline(preferencesQuery.data)
  }, [preferencesQuery.data])

  // Each slice's baseline is re-seeded in lockstep with the slice itself, so
  // the dirty comparison always tracks the *last-seeded server value* rather
  // than a snapshot frozen at mount — a refetch (e.g. after a partial save)
  // moves the goalposts instead of leaving the other slices permanently dirty.
  useEffect(() => {
    const seeded = profileDraft(user, adminNotes)
    setProfile(seeded)
    setProfileBaseline(seeded)
  }, [user, adminNotes])
  useEffect(() => {
    const seeded = macroDraft(targetQuery.data)
    setMacros(seeded)
    setMacrosBaseline(seeded)
  }, [targetQuery.data])
  useEffect(() => {
    const seeded = currentMealPlanId ?? ''
    setMealPlanId(seeded)
    setMealPlanBaseline(seeded)
  }, [currentMealPlanId])
  useEffect(() => {
    const availableIds = new Set(workoutPlans.map(workout => workout.id))
    const seeded = currentWorkoutIds.filter(workoutId => availableIds.has(workoutId))
    setWorkoutIds(seeded)
    setWorkoutIdsBaseline(seeded)
  }, [currentWorkoutIds, workoutPlans])

  const macroValues = useMemo(() => ({
    calories: Number(macros.calories),
    proteinG: Number(macros.proteinG),
    carbsG: Number(macros.carbsG),
    fatG: Number(macros.fatG),
    fiberGMin: optionalNumber(macros.fiberGMin),
    calorieTolPct: requiredNumber(macros.calorieTolPct),
    proteinTolPct: requiredNumber(macros.proteinTolPct),
    carbsTolPct: requiredNumber(macros.carbsTolPct),
    fatTolPct: requiredNumber(macros.fatTolPct),
  }), [macros])
  const toleranceValues = [macroValues.calorieTolPct, macroValues.proteinTolPct, macroValues.carbsTolPct, macroValues.fatTolPct]
  const macrosValid = macroValues.calories > 0
    && macroValues.proteinG >= 0
    && macroValues.carbsG >= 0
    && macroValues.fatG >= 0
    && (macroValues.fiberGMin == null || macroValues.fiberGMin >= 0)
    && toleranceValues.every(value => Number.isFinite(value) && value >= 0 && value <= 100)
  const macrosValidationError = 'Calories must be greater than 0; macros and fiber must be non-negative; every tolerance must be between 0% and 100%.'
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
      queryClient.invalidateQueries({ queryKey: ['athlete-admin-note', user.id] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
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
        calorie_tol_pct: macroValues.calorieTolPct,
        protein_tol_pct: macroValues.proteinTolPct,
        carbs_tol_pct: macroValues.carbsTolPct,
        fat_tol_pct: macroValues.fatTolPct,
        is_locked: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-nutrition-target', user.id] })
      queryClient.invalidateQueries({ queryKey: ['macroTarget', user.id] })
    },
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
    },
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
    },
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
      calorieTolPct: macros.calorieTolPct,
      proteinTolPct: macros.proteinTolPct,
      carbsTolPct: macros.carbsTolPct,
      fatTolPct: macros.fatTolPct,
    })
  }

  function toggleWorkout(workoutId: string) {
    setWorkoutIds(current => current.includes(workoutId)
      ? current.filter(id => id !== workoutId)
      : [...current, workoutId]
    )
  }

  const dirtySections = useMemo(() => {
    const dirty = new Set<SectionKey>()
    if (isDirty(profile, profileBaseline)) dirty.add('profile')
    if (isDirty(macros, macrosBaseline)) dirty.add('macros')
    if (isDirty(mealPlanId, mealPlanBaseline)) dirty.add('mealPlan')
    if (isDirty(workoutIds, workoutIdsBaseline)) dirty.add('workouts')
    if (isDirty(preferences, preferencesBaseline)) dirty.add('preferences')
    return dirty
  }, [
    profile, profileBaseline,
    macros, macrosBaseline,
    mealPlanId, mealPlanBaseline,
    workoutIds, workoutIdsBaseline,
    preferences, preferencesBaseline,
  ])
  const dirtyLabels = SECTION_ORDER.filter(key => dirtySections.has(key)).map(key => SECTION_LABELS[key])
  const hasDirtySections = dirtySections.size > 0
  const [isSavingAll, setIsSavingAll] = useState(false)

  // Guard against closing the tab/browser with unsaved edits. This is
  // deliberately a plain beforeunload listener rather than the shared
  // useUnsavedChangesGuard hook — that hook also blocks in-app navigation via
  // useBlocker and pairs it with a Slovak-copy ConfirmDialog, neither of
  // which belongs on this English-language coach surface.
  //
  // Depends on the boolean hasDirtySections, not dirtySections itself: the
  // Set is rebuilt (new reference) by the useMemo above on every keystroke,
  // which would otherwise tear down and re-add this listener on every
  // character typed.
  useEffect(() => {
    if (!hasDirtySections) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasDirtySections])

  // Advances one section's baseline to the value that was actually sent to the
  // server, synchronously right after that section's save resolves — before any
  // later section in the loop is attempted. This must happen inline in the save
  // loop (not via the re-seeding useEffects above, which only fire once fresh
  // query data comes back from an async refetch): saveMacros in particular
  // *inserts* a new versioned nutrition_targets row rather than upserting, so if
  // a later section fails and the coach hits Save again before that refetch
  // lands, a stale macrosBaseline would leave macros marked dirty and insert a
  // second, duplicate version. Capturing the value before its await (rather than
  // reading state after) also avoids baselining edits the coach made while the
  // request was in flight.
  function markSectionSaved(key: SectionKey, sentValue: ProfileDraft | MacroDraft | string | string[] | UserNutritionPreferences) {
    if (key === 'profile') setProfileBaseline(sentValue as ProfileDraft)
    else if (key === 'macros') setMacrosBaseline(sentValue as MacroDraft)
    else if (key === 'mealPlan') setMealPlanBaseline(sentValue as string)
    else if (key === 'workouts') setWorkoutIdsBaseline(sentValue as string[])
    else setPreferencesBaseline(sentValue as UserNutritionPreferences)
  }

  async function handleSaveAll() {
    if (dirtySections.size === 0 || isSavingAll) return
    setIsSavingAll(true)
    const saved: string[] = []
    try {
      for (const key of SECTION_ORDER) {
        if (!dirtySections.has(key)) continue
        try {
          if (key === 'profile') {
            const sentValue = profile
            await saveProfile.mutateAsync()
            markSectionSaved(key, sentValue)
          } else if (key === 'macros') {
            const sentValue = macros
            await saveMacros.mutateAsync()
            markSectionSaved(key, sentValue)
          } else if (key === 'mealPlan') {
            const sentValue = mealPlanId
            await saveMealPlan.mutateAsync()
            markSectionSaved(key, sentValue)
          } else if (key === 'workouts') {
            const sentValue = workoutIds
            await saveWorkouts.mutateAsync()
            markSectionSaved(key, sentValue)
          } else {
            const sentValue = preferences
            await savePreferences.mutateAsync(preferences)
            markSectionSaved(key, sentValue)
          }
          saved.push(SECTION_LABELS[key])
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const kept = saved.length > 0
            ? `${saved.join(', ')} saved successfully and will not be rolled back.`
            : 'Nothing else was saved yet.'
          notify(
            `Couldn’t save ${SECTION_LABELS[key]}: ${message}. ${kept} Remaining unsaved changes are still pending — fix the issue and save again.`,
            'error'
          )
          return
        }
      }
      notify(saved.length > 1 ? `Saved: ${saved.join(', ')}.` : `${saved[0]} saved.`)
    } finally {
      setIsSavingAll(false)
    }
  }

  return (
    <>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="xl:col-span-2">
        <div className="mb-5">
          <h2 className="text-base font-bold text-text-primary">User profile and access</h2>
          <p className="mt-1 text-sm text-text-secondary">Edit coach-managed profile fields and decide which user areas are available.</p>
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">User access</p>
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
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Admin notes</label>
          <textarea className="min-h-24 w-full resize-y rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" value={profile.adminNotes} onChange={event => setProfile(current => ({ ...current, adminNotes: event.target.value }))} placeholder="Context only coaches can see…" />
        </div>
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
        <div className="mt-5 border-t border-outline-subtle pt-5">
          <h3 className="text-sm font-bold text-text-primary">Generation tolerances</h3>
          <p className="mt-1 text-xs leading-5 text-text-secondary">Allowed daily variance from each target. Wider tolerances make plans easier to publish, but reduce macro precision.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
            <Input label="Calories tolerance (%)" type="number" min="0" max="100" step="0.5" value={macros.calorieTolPct} onChange={event => setMacros(current => ({ ...current, calorieTolPct: event.target.value }))} />
            <Input label="Protein tolerance (%)" type="number" min="0" max="100" step="0.5" value={macros.proteinTolPct} onChange={event => setMacros(current => ({ ...current, proteinTolPct: event.target.value }))} />
            <Input label="Carbs tolerance (%)" type="number" min="0" max="100" step="0.5" value={macros.carbsTolPct} onChange={event => setMacros(current => ({ ...current, carbsTolPct: event.target.value }))} />
            <Input label="Fat tolerance (%)" type="number" min="0" max="100" step="0.5" value={macros.fatTolPct} onChange={event => setMacros(current => ({ ...current, fatTolPct: event.target.value }))} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={calculateFromProfile}>Calculate from profile</Button>
        </div>

        <div className="mt-5 border-t border-outline-subtle pt-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Assigned meal plan</label>
          <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary" value={mealPlanId} onChange={event => setMealPlanId(event.target.value)}>
            <option value="">No meal plan</option>
            {currentMealPlanUnavailable && currentMealPlanId && <option value={currentMealPlanId}>Current generated or unavailable plan</option>}
            {mealPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/admin/nutrition/meal-plans/new?user=${user.id}`)} disabled={!targetQuery.data}>Create plan for these macros</Button>
            <Button onClick={() => navigate(`/admin/nutrition/meal-plans/generate?user=${user.id}`)} disabled={!targetQuery.data}>
              Generate plan from macros
            </Button>
          </div>
          {!targetQuery.data && <p className="mt-2 text-xs text-text-secondary">Save changes first to open a target-aware meal-plan editor.</p>}
          {currentMealPlanUnavailable && <p className="mt-2 text-xs text-text-secondary">The current plan is generated, inactive, or unavailable in the manual library. Choose another plan or “No meal plan” to replace it.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-bold text-text-primary">Workout assignments</h2>
        <p className="mt-1 text-sm text-text-secondary">Select every active coach plan this user should see.</p>
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
          {workoutPlans.length === 0 ? <p className="text-sm text-text-secondary">No active workout plans are available.</p> : workoutPlans.map(workout => (
            <label key={workout.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-subtle bg-surface px-3 py-2.5 text-sm text-text-primary">
              <input type="checkbox" checked={workoutIds.includes(workout.id)} onChange={() => toggleWorkout(workout.id)} />
              <span className="font-medium">{workout.name}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => navigate(`/admin/workouts/new?user=${user.id}`)}>Create workout for {user.full_name ?? 'user'}</Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-bold text-text-primary">Nutrition preferences</h2>
        <p className="mt-1 text-sm text-text-secondary">Inputs for the meal-plan generator. The athlete can also edit these on their profile.</p>
        <div className="mt-4">
          <NutritionPreferencesForm value={preferences} onChange={setPreferences} locale="en" />
        </div>
      </Card>
      </div>

      {dirtySections.size > 0 && (
        <Card className="sticky bottom-0 z-20 mt-5 flex flex-col gap-3 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">Unsaved:</span> {dirtyLabels.join(', ')}
            </p>
            {dirtySections.has('macros') && !macrosValid && (
              <p className="mt-1 text-xs text-error">{macrosValidationError}</p>
            )}
          </div>
          <Button
            onClick={handleSaveAll}
            loading={isSavingAll}
            disabled={isSavingAll || (dirtySections.has('macros') && !macrosValid)}
          >
            Save changes
          </Button>
        </Card>
      )}
    </>
  )
}
