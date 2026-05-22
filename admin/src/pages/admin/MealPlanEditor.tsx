import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Button, Input, Modal } from '../../components/ui'
import type { Profile, Recipe } from '../../types/database'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const DAY_SHORTS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const
type MealType = typeof MEAL_TYPES[number]
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'BREAKFAST',
  lunch: 'LUNCH',
  dinner: 'DINNER',
}
const MEAL_TIMES: Record<MealType, string> = {
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '19:00',
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

function useRecipes() {
  return useQuery<Recipe[]>({
    queryKey: ['recipes-admin'],
    queryFn: async () => {
      const { data } = await supabase.from('recipes').select('*').order('name')
      return data ?? []
    },
  })
}

function useProfiles() {
  return useQuery<Pick<Profile, 'id' | 'email' | 'full_name'>[]>({
    queryKey: ['profiles-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('full_name')
      return data ?? []
    },
  })
}

// ─── Assign Users Dialog ──────────────────────────────────────────────────────

function AssignUsersDialog({
  open,
  onClose,
  profiles,
  value,
  onChange,
}: {
  open: boolean
  onClose: () => void
  profiles: Pick<Profile, 'id' | 'email' | 'full_name'>[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [filterAssigned, setFilterAssigned] = useState(false)
  const [page, setPage] = useState(0)
  const [localIds, setLocalIds] = useState<Set<string>>(new Set(value))

  useEffect(() => {
    if (open) {
      setLocalIds(new Set(value))
      setSearch('')
      setFilterAssigned(false)
      setPage(0)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const PAGE_SIZE = 10

  const filtered = profiles
    .filter(p => {
      if (filterAssigned && !localIds.has(p.id)) return false
      if (search) {
        const q = search.toLowerCase()
        return (p.full_name?.toLowerCase().includes(q) ?? false) || p.email.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      const aA = localIds.has(a.id) ? 0 : 1
      const bA = localIds.has(b.id) ? 0 : 1
      return aA - bA
    })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggle(id: string) {
    setLocalIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setPage(0)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Users"
      footer={
        <>
          <span className="text-xs text-[var(--text-muted)]">{localIds.size} assigned</span>
          <Button onClick={() => { onChange([...localIds]); onClose() }}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Search users…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
        />
        <div className="flex gap-2">
          {(['all', 'assigned'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilterAssigned(f === 'assigned'); setPage(0) }}
              className={`text-xs px-3 py-1 rounded-full border cursor-pointer bg-transparent transition-colors ${
                (f === 'assigned') === filterAssigned
                  ? 'border-[var(--text)] text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--text-muted)]'
              }`}
            >
              {f === 'all' ? 'All' : 'Assigned only'}
            </button>
          ))}
        </div>
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {pageItems.map(p => {
            const isAssigned = localIds.has(p.id)
            return (
              <div
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-3 py-2.5 cursor-pointer rounded px-1 -mx-1 ${
                  isAssigned ? 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]' : 'hover:bg-[var(--bg-card)]'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isAssigned ? 'bg-green-900/40 text-green-400' : 'bg-[var(--bg)] text-[var(--text-muted)]'
                }`}>
                  {(p.full_name ?? p.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)] truncate">{p.full_name ?? '—'}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{p.email}</p>
                </div>
                <div className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${
                  isAssigned ? 'bg-green-900/40 border-green-700' : 'border-[var(--border)]'
                }`}>
                  {isAssigned && <span className="text-green-400 text-[10px]">✓</span>}
                </div>
              </div>
            )
          })}
          {pageItems.length === 0 && (
            <p className="text-sm text-[var(--text-disabled)] py-4 text-center">No users found</p>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 bg-[var(--bg)] border border-[var(--border)] rounded disabled:opacity-30 cursor-pointer"
              >
                ←
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-2 py-1 bg-[var(--bg)] border border-[var(--border)] rounded disabled:opacity-30 cursor-pointer"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function MealPlanEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isNew = !id

  const { data: recipes = [] } = useRecipes()
  const { data: profiles = [] } = useProfiles()

  const [planName, setPlanName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedDay, setSelectedDay] = useState(0)
  const [meals, setMeals] = useState<MealDraft[]>(initMeals)
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)

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
        for (const meal of existingMeals) {
          const mealType = meal.name.toLowerCase() as MealType
          if (!MEAL_TYPES.includes(mealType)) continue
          const dayIdx = meal.day_of_week ?? 0
          const draft = drafts.find(d => d.day_of_week === dayIdx && d.meal_type === mealType)
          if (!draft) continue

          const { data: mprRows } = await supabase
            .from('meal_plan_recipes')
            .select('recipe_id')
            .eq('meal_id', meal.id)

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

      // Delete existing meals (cascades to meal_plan_recipes + meal_foods)
      await supabase.from('meals').delete().eq('meal_plan_id', planId)

      // Insert non-empty meal drafts
      const nonEmpty = meals.filter(m => m.recipes.length > 0)
      for (const draft of nonEmpty) {
        const { data: meal, error: mErr } = await supabase
          .from('meals')
          .insert({
            meal_plan_id: planId,
            name: draft.meal_type.charAt(0).toUpperCase() + draft.meal_type.slice(1),
            day_of_week: draft.day_of_week,
            time_of_day: MEAL_TIMES[draft.meal_type],
            sort_order: draft.day_of_week * 3 + MEAL_TYPES.indexOf(draft.meal_type),
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
      const { data: currentRows } = await supabase
        .from('user_meal_plans')
        .select('user_id')
        .eq('meal_plan_id', planId)
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
      for (const uid of toRemove) {
        await supabase.from('user_meal_plans').delete()
          .eq('meal_plan_id', planId)
          .eq('user_id', uid)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      qc.invalidateQueries({ queryKey: ['meal-plan-assignment-counts'] })
      navigate('/admin/nutrition')
    },
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
          </button>
        ))}
      </div>

      {/* Meal columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
    </div>
  )
}
