import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Button, ConfirmDialog, Input, useNotice } from '../../components/ui'
import { AssignUsersDialog } from '../../components/AssignUsersDialog'
import type { Profile, Recipe } from '../../types/database'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const DAY_SHORTS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'BREAKFAST',
  lunch: 'LUNCH',
  dinner: 'DINNER',
  snack: 'SNACK',
}
const MEAL_TIMES: Record<MealType, string> = {
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '19:00',
  snack: '16:00',
}

interface RecipeDraft {
  recipe_id: string
  recipe_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

interface MealDraft {
  day_of_week: number
  meal_type: MealType
  recipes: RecipeDraft[]
}

function initMeals(): MealDraft[] {
  return DAYS.flatMap((_, d) =>
    MEAL_TYPES.map(t => ({ day_of_week: d, meal_type: t, recipes: [] }))
  )
}

interface ExistingMealRow {
  id: string
  name: string
  day_of_week: number | null
}

interface ManagedMeal {
  id: string
  meal_type: MealType
  dayIdx: number
}

// Splits the meals stored for a plan into the ones this editor manages (a
// recognized meal type on a valid day, which gets loaded into a draft and
// re-inserted on save) and the ids of everything else. The unmanaged ids are
// preserved on save so an edit never destroys a meal the editor can't render.
export function classifyExistingMeals(existingMeals: ExistingMealRow[]): {
  managed: ManagedMeal[]
  unmanagedMealIds: string[]
} {
  const managed: ManagedMeal[] = []
  const unmanagedMealIds: string[] = []
  for (const meal of existingMeals) {
    const mealType = meal.name.toLowerCase() as MealType
    const dayIdx = meal.day_of_week ?? 0
    const recognized = MEAL_TYPES.includes(mealType) && dayIdx >= 0 && dayIdx < DAYS.length
    if (!recognized) {
      unmanagedMealIds.push(meal.id)
      continue
    }
    managed.push({ id: meal.id, meal_type: mealType, dayIdx })
  }
  return { managed, unmanagedMealIds }
}

function useRecipes() {
  return useQuery<Recipe[]>({
    queryKey: ['recipes-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('recipes').select('*').order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

function useProfiles() {
  return useQuery<Pick<Profile, 'id' | 'email' | 'full_name' | 'is_admin' | 'is_blocked'>[]>({
    queryKey: ['profiles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, is_admin, is_blocked')
        .order('full_name')
      if (error) throw error
      return data ?? []
    },
  })
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function MealPlanEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { notify } = useNotice()
  const isNew = !id

  const { data: recipes = [] } = useRecipes()
  const { data: profiles = [] } = useProfiles()

  const [planName, setPlanName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedDay, setSelectedDay] = useState(0)
  const [meals, setMeals] = useState<MealDraft[]>(initMeals)
  // Ids of stored meals this editor loaded but does not manage (unrecognized
  // type/day). Kept out of the save-time delete so they are never destroyed.
  const [unmanagedMealIds, setUnmanagedMealIds] = useState<string[]>([])
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)

  useEffect(() => {
    if (isNew) return
    async function load() {
      const { data: plan } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('id', id!)
        .single()
      if (!plan) return

      setPlanName(plan.name)
      setDescription(plan.description ?? '')

      const { data: existingMeals } = await supabase
        .from('meals')
        .select('id, name, day_of_week')
        .eq('meal_plan_id', id!)

      if (existingMeals?.length) {
        const drafts = initMeals()
        const { managed, unmanagedMealIds: preserved } = classifyExistingMeals(existingMeals)
        // Remember unmanaged rows so savePlan can leave them untouched.
        setUnmanagedMealIds(preserved)
        for (const item of managed) {
          const draft = drafts.find(d => d.day_of_week === item.dayIdx && d.meal_type === item.meal_type)
          if (!draft) continue

          const { data: mprRows } = await supabase
            .from('meal_plan_recipes')
            .select('recipe_id')
            .eq('meal_id', item.id)

          const recipeIds = (mprRows ?? []).map(r => r.recipe_id)
          if (recipeIds.length) {
            const { data: recipeData } = await supabase
              .from('recipes')
              .select('id, name, calories, protein_g, carbs_g, fat_g')
              .in('id', recipeIds)
            draft.recipes = (recipeData ?? []).map(r => ({
              recipe_id: r.id,
              recipe_name: r.name,
              calories: r.calories,
              protein_g: r.protein_g,
              carbs_g: r.carbs_g,
              fat_g: r.fat_g,
            }))
          }
        }
        setMeals(drafts)
      }

      const { data: assignments } = await supabase
        .from('user_meal_plans')
        .select('user_id')
        .eq('meal_plan_id', id!)
      setAssignedUserIds((assignments ?? []).map(a => a.user_id))
    }
    load()
  }, [id, isNew])

  function addRecipe(dayOfWeek: number, mealType: MealType, recipeId: string) {
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) return
    setMeals(prev => prev.map(m =>
      m.day_of_week === dayOfWeek && m.meal_type === mealType
        ? {
            ...m,
            recipes: [...m.recipes, {
              recipe_id: recipe.id,
              recipe_name: recipe.name,
              calories: recipe.calories,
              protein_g: recipe.protein_g,
              carbs_g: recipe.carbs_g,
              fat_g: recipe.fat_g,
            }],
          }
        : m
    ))
  }

  function removeRecipe(dayOfWeek: number, mealType: MealType, recipeIndex: number) {
    setMeals(prev => prev.map(m =>
      m.day_of_week === dayOfWeek && m.meal_type === mealType
        ? { ...m, recipes: m.recipes.filter((_, i) => i !== recipeIndex) }
        : m
    ))
  }

  function copySelectedDayToWeek() {
    const sourceMeals = MEAL_TYPES.map(type => getDraft(selectedDay, type))
    setMeals(previous => previous.map(meal => {
      const source = sourceMeals.find(item => item.meal_type === meal.meal_type)
      if (!source || meal.day_of_week === selectedDay) return meal
      return { ...meal, recipes: source.recipes.map(recipe => ({ ...recipe })) }
    }))
    setCopyDialogOpen(false)
    notify(`${DAYS[selectedDay]} copied to the rest of the week.`)
  }

  const savePlan = useMutation({
    mutationFn: async () => {
      let planId: string
      if (isNew) {
        const { data, error } = await supabase
          .from('meal_plans')
          .insert({ name: planName, description: description || null, is_active: true })
          .select()
          .single()
        if (error) throw error
        planId = data.id
      } else {
        const { error } = await supabase
          .from('meal_plans')
          .update({ name: planName, description: description || null })
          .eq('id', id!)
        if (error) throw error
        planId = id!
      }

      // Invariant: only meals this editor loaded/manages may be deleted. We
      // remove every meal on the plan EXCEPT the unmanaged rows captured at load
      // (meal types/days this editor can't render), then re-insert the managed
      // drafts below — so an edit+save never destroys an unmanaged meal.
      // (Deleting a meal cascades to meal_plan_recipes + meal_foods.)
      let deleteMeals = supabase.from('meals').delete().eq('meal_plan_id', planId)
      if (unmanagedMealIds.length) {
        deleteMeals = deleteMeals.not('id', 'in', `(${unmanagedMealIds.join(',')})`)
      }
      const { error: deleteMealsError } = await deleteMeals
      if (deleteMealsError) throw deleteMealsError

      // Insert non-empty meal drafts
      const nonEmpty = meals.filter(m => m.recipes.length > 0)
      for (const draft of nonEmpty) {
        const { data: meal, error: mErr } = await supabase
          .from('meals')
          .insert({
            meal_plan_id: planId,
            name: MEAL_LABELS[draft.meal_type],
            day_of_week: draft.day_of_week,
            time_of_day: MEAL_TIMES[draft.meal_type],
            sort_order: draft.day_of_week * MEAL_TYPES.length + MEAL_TYPES.indexOf(draft.meal_type),
          })
          .select()
          .single()
        if (mErr) throw mErr

        const { error: mprErr } = await supabase.from('meal_plan_recipes').insert(
          draft.recipes.map(r => ({
            meal_plan_id: planId,
            meal_id: meal.id,
            recipe_id: r.recipe_id,
          }))
        )
        if (mprErr) throw mprErr

        const { error: mfErr } = await supabase.from('meal_foods').insert(
          draft.recipes.map(r => ({
            meal_id: meal.id,
            name: r.recipe_name,
            amount_grams: 100,
            calories: r.calories,
            protein_g: r.protein_g,
            carbs_g: r.carbs_g,
            fat_g: r.fat_g,
          }))
        )
        if (mfErr) throw mfErr
      }

      // Sync user_meal_plans
      const { data: currentRows, error: currentRowsError } = await supabase
        .from('user_meal_plans')
        .select('user_id')
        .eq('meal_plan_id', planId)
      if (currentRowsError) throw currentRowsError
      const currentIds = new Set((currentRows ?? []).map(r => r.user_id))
      const newIds = new Set(assignedUserIds)

      const toAdd = assignedUserIds.filter(uid => !currentIds.has(uid))
      const toRemove = [...currentIds].filter(uid => !newIds.has(uid))

      if (toAdd.length) {
        const { error } = await supabase.from('user_meal_plans').insert(
          toAdd.map(uid => ({ meal_plan_id: planId, user_id: uid }))
        )
        if (error) throw error
      }
      if (toRemove.length) {
        const { error } = await supabase.from('user_meal_plans').delete()
          .eq('meal_plan_id', planId)
          .in('user_id', toRemove)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      qc.invalidateQueries({ queryKey: ['meal-plan-assignment-counts'] })
      notify(isNew ? 'Meal plan created.' : 'Meal plan saved.')
      navigate('/admin/nutrition')
    },
    onError: error => notify(`Couldn’t save meal plan: ${error.message}`, 'error'),
  })

  function getDraft(d: number, t: MealType): MealDraft {
    return meals.find(m => m.day_of_week === d && m.meal_type === t)!
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/admin/nutrition')}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer shrink-0"
        >
          ← Meal Plans
        </button>
        <div className="flex-1 min-w-40">
          <Input
            value={planName}
            onChange={e => setPlanName(e.target.value)}
            placeholder="Plan name…"
          />
        </div>
        <button
          onClick={() => setAssignDialogOpen(true)}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border border-[var(--border)] rounded-md px-3 py-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          Assigned Users ({assignedUserIds.length})
        </button>
        <Button
          onClick={() => savePlan.mutate()}
          disabled={!planName || savePlan.isPending}
          className="shrink-0"
        >
          {savePlan.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline bg-surface-elevated px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Build one day, then reuse it</p>
          <p className="mt-0.5 text-xs text-text-secondary">Copy the selected day to the rest of the week and make any exceptions afterward.</p>
        </div>
        <Button variant="ghost" onClick={() => setCopyDialogOpen(true)} disabled={MEAL_TYPES.every(type => getDraft(selectedDay, type).recipes.length === 0)}>
          Copy {DAY_SHORTS[selectedDay]} to week
        </Button>
      </div>

      <div className="mb-5">
        <Input
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>

      {/* Day tabs */}
      <div className="flex gap-0 mb-6 border-b border-[var(--border)] overflow-x-auto">
        {DAY_SHORTS.map((day, i) => (
          <button
            key={day}
            onClick={() => setSelectedDay(i)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px cursor-pointer bg-transparent whitespace-nowrap transition-colors ${
              selectedDay === i
                ? 'border-[var(--text)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {day}
            {MEAL_TYPES.reduce((sum, type) => sum + getDraft(i, type).recipes.length, 0) > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${selectedDay === i ? 'bg-surface-elevated text-text-primary' : 'bg-surface-highest text-text-secondary'}`}>
                {MEAL_TYPES.reduce((sum, type) => sum + getDraft(i, type).recipes.length, 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Meal columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MEAL_TYPES.map(mealType => {
          const draft = getDraft(selectedDay, mealType)
          return (
            <div key={mealType} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                {MEAL_LABELS[mealType]}
              </p>

              {draft.recipes.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {draft.recipes.map((r, ri) => (
                    <span
                      key={ri}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded text-xs text-[var(--text-muted)]"
                    >
                      {r.recipe_name}
                      <button
                        onClick={() => removeRecipe(selectedDay, mealType, ri)}
                        className="text-[var(--text-disabled)] hover:text-red-400 bg-transparent border-0 cursor-pointer"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <select
                className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-xs text-[var(--text)] outline-none"
                value=""
                onChange={e => { if (e.target.value) addRecipe(selectedDay, mealType, e.target.value) }}
              >
                <option value="" disabled>+ Add recipe…</option>
                {recipes
                  .filter(r => !draft.recipes.some(d => d.recipe_id === r.id))
                  .map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                }
              </select>
            </div>
          )
        })}
      </div>

      {savePlan.isError && (
        <p className="mt-4 text-sm text-red-400">
          Save failed: {(savePlan.error as Error).message}
        </p>
      )}

      <AssignUsersDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        profiles={profiles}
        value={assignedUserIds}
        onChange={setAssignedUserIds}
      />

      <ConfirmDialog
        open={copyDialogOpen}
        title={`Copy ${DAYS[selectedDay]} to the week?`}
        description="This replaces the recipe selections for the other six days. You can fine-tune individual days right after copying."
        confirmLabel="Copy day"
        onClose={() => setCopyDialogOpen(false)}
        onConfirm={copySelectedDayToWeek}
      />
    </div>
  )
}
