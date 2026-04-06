// admin/src/pages/admin/Nutrition.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, Input, Modal, Table, Th, Td } from '../../components/ui'
import type { Recipe, RecipeIngredient, MealPlan } from '../../types/database'

// ─── Recipes ────────────────────────────────────────────────────────────────

type IngredientDraft = Omit<RecipeIngredient, 'id' | 'recipe_id'>

const blankIngredient = (i: number): IngredientDraft => ({
  name: '', quantity: null, unit: '', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sort_order: i,
})

function calcMacros(ingredients: IngredientDraft[]) {
  return ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein_g: acc.protein_g + ing.protein_g,
      carbs_g: acc.carbs_g + ing.carbs_g,
      fat_g: acc.fat_g + ing.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
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

function RecipesTab() {
  const qc = useQueryClient()
  const { data: recipes = [], isLoading } = useRecipes()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [form, setForm] = useState({ name: '', description: '', prep_time_min: '', servings: '1' })
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([blankIngredient(0)])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', prep_time_min: '', servings: '1' })
    setIngredients([blankIngredient(0)])
    setEditorOpen(true)
  }

  async function openEdit(r: Recipe) {
    setEditing(r)
    setForm({ name: r.name, description: r.description ?? '', prep_time_min: String(r.prep_time_min ?? ''), servings: String(r.servings) })
    const { data } = await supabase.from('recipe_ingredients').select('*').eq('recipe_id', r.id).order('sort_order')
    setIngredients(data?.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit ?? '', calories: i.calories, protein_g: i.protein_g, carbs_g: i.carbs_g, fat_g: i.fat_g, sort_order: i.sort_order })) ?? [blankIngredient(0)])
    setEditorOpen(true)
  }

  const saveRecipe = useMutation({
    mutationFn: async () => {
      const macros = calcMacros(ingredients)
      const payload = {
        name: form.name,
        description: form.description || null,
        prep_time_min: form.prep_time_min ? Number(form.prep_time_min) : null,
        servings: Number(form.servings),
        ...macros,
      }
      if (editing) {
        await supabase.from('recipes').update(payload).eq('id', editing.id)
        await supabase.from('recipe_ingredients').delete().eq('recipe_id', editing.id)
        if (ingredients.length) {
          await supabase.from('recipe_ingredients').insert(ingredients.map((ing, i) => ({ ...ing, recipe_id: editing.id, sort_order: i })))
        }
      } else {
        const { data: r, error } = await supabase.from('recipes').insert(payload).select().single()
        if (error) throw error
        if (ingredients.length) {
          await supabase.from('recipe_ingredients').insert(ingredients.map((ing, i) => ({ ...ing, recipe_id: r.id, sort_order: i })))
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recipes-admin'] }); setEditorOpen(false) },
  })

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => { await supabase.from('recipes').delete().eq('id', id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes-admin'] }),
  })

  function updateIngredient(i: number, field: keyof IngredientDraft, value: string | number | null) {
    setIngredients(ings => ings.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing))
  }

  const macros = calcMacros(ingredients)

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-muted)]">{recipes.length} recipes in library</p>
        <Button onClick={openCreate}>+ Add recipe</Button>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-disabled)]">Loading…</p> : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th><Th>Calories</Th><Th>Protein</Th><Th>Carbs</Th><Th>Fat</Th><Th>Prep</Th><Th>{''}</Th>
            </tr>
          </thead>
          <tbody>
            {recipes.map(r => (
              <tr key={r.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td className="text-[var(--text)] font-semibold">{r.name}</Td>
                <Td>{Math.round(r.calories)} kcal</Td>
                <Td>{r.protein_g.toFixed(1)}g</Td>
                <Td>{r.carbs_g.toFixed(1)}g</Td>
                <Td>{r.fat_g.toFixed(1)}g</Td>
                <Td>{r.prep_time_min ? `${r.prep_time_min} min` : '—'}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(r)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">Edit</button>
                    <button onClick={() => { if (confirm('Delete this recipe?')) deleteRecipe.mutate(r.id) }} className="text-xs text-red-400 bg-transparent border-0 cursor-pointer">Delete</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Edit Recipe' : 'New Recipe'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveRecipe.mutate()} loading={saveRecipe.isPending} disabled={!form.name}>
              {editing ? 'Save changes' : 'Add recipe'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Recipe name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Overnight Oats" required />
          <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prep time (min)" type="number" value={form.prep_time_min} onChange={e => setForm(f => ({ ...f, prep_time_min: e.target.value }))} />
            <Input label="Servings" type="number" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: e.target.value }))} />
          </div>

          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 grid grid-cols-4 gap-2 text-center">
            {[['Calories', `${Math.round(macros.calories)} kcal`], ['Protein', `${macros.protein_g.toFixed(1)}g`], ['Carbs', `${macros.carbs_g.toFixed(1)}g`], ['Fat', `${macros.fat_g.toFixed(1)}g`]].map(([label, val]) => (
              <div key={label}>
                <p className="text-[9px] text-[var(--text-disabled)] uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold text-[var(--text)]">{val}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Ingredients</p>
            {ingredients.map((ing, i) => (
              <div key={i} className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 mb-2">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Input label="Name" value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} placeholder="e.g. Oats" />
                  <Input label="Quantity" type="number" value={String(ing.quantity ?? '')} onChange={e => updateIngredient(i, 'quantity', e.target.value ? Number(e.target.value) : null)} />
                  <Input label="Unit" value={ing.unit ?? ''} onChange={e => updateIngredient(i, 'unit', e.target.value)} placeholder="g, ml, tbsp" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Input label="Calories" type="number" value={String(ing.calories)} onChange={e => updateIngredient(i, 'calories', Number(e.target.value))} />
                  <Input label="Protein" type="number" value={String(ing.protein_g)} onChange={e => updateIngredient(i, 'protein_g', Number(e.target.value))} />
                  <Input label="Carbs" type="number" value={String(ing.carbs_g)} onChange={e => updateIngredient(i, 'carbs_g', Number(e.target.value))} />
                  <div className="flex gap-1 items-end">
                    <Input label="Fat" type="number" value={String(ing.fat_g)} onChange={e => updateIngredient(i, 'fat_g', Number(e.target.value))} />
                    <button onClick={() => setIngredients(ings => ings.filter((_, idx) => idx !== i))} className="text-xs text-red-400 bg-transparent border-0 cursor-pointer pb-2">✕</button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setIngredients(ings => [...ings, blankIngredient(ings.length)])} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">
              + Add ingredient
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Meal Plans ──────────────────────────────────────────────────────────────

function useMealPlans() {
  return useQuery<MealPlan[]>({
    queryKey: ['meal-plans-admin'],
    queryFn: async () => {
      const { data } = await supabase.from('meal_plans').select('*').order('name')
      return data ?? []
    },
  })
}

interface MealDraft { name: string; time_of_day: string; recipes: { recipe_id: string; meal_type: string }[] }

function MealPlansTab() {
  const qc = useQueryClient()
  const { data: mealPlans = [], isLoading } = useMealPlans()
  const { data: recipes = [] } = useRecipes()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<MealPlan | null>(null)
  const [form, setForm] = useState({ name: '', description: '', valid_from: '', valid_to: '', is_active: true })
  const [meals, setMeals] = useState<MealDraft[]>([{ name: 'Breakfast', time_of_day: '08:00', recipes: [] }])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', valid_from: '', valid_to: '', is_active: true })
    setMeals([{ name: 'Breakfast', time_of_day: '08:00', recipes: [] }])
    setEditorOpen(true)
  }

  async function openEditPlan(p: MealPlan) {
    setEditing(p)
    setForm({ name: p.name, description: p.description ?? '', valid_from: p.valid_from ?? '', valid_to: p.valid_to ?? '', is_active: p.is_active })

    // Fetch existing meal slots
    const { data: existingMeals } = await supabase
      .from('meals')
      .select('id, name, time_of_day, sort_order')
      .eq('meal_plan_id', p.id)
      .order('sort_order')

    if (existingMeals && existingMeals.length > 0) {
      const mealDrafts: MealDraft[] = await Promise.all(
        existingMeals.map(async meal => {
          const { data: mprData } = await supabase
            .from('meal_plan_recipes')
            .select('recipe_id, meal_type')
            .eq('meal_id', meal.id)
          return {
            name: meal.name,
            time_of_day: meal.time_of_day ?? '',
            recipes: (mprData ?? []).map(r => ({ recipe_id: r.recipe_id, meal_type: r.meal_type ?? 'breakfast' })),
          }
        })
      )
      setMeals(mealDrafts)
    } else {
      setMeals([{ name: 'Breakfast', time_of_day: '08:00', recipes: [] }])
    }

    setEditorOpen(true)
  }

  const savePlan = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        is_active: form.is_active,
      }
      let planId: string
      if (editing) {
        await supabase.from('meal_plans').update(payload).eq('id', editing.id)
        planId = editing.id
        const { data: existingMeals } = await supabase.from('meals').select('id').eq('meal_plan_id', planId)
        if (existingMeals) {
          for (const m of existingMeals) {
            await supabase.from('meal_plan_recipes').delete().eq('meal_id', m.id)
          }
          await supabase.from('meals').delete().eq('meal_plan_id', planId)
        }
      } else {
        const { data: plan, error } = await supabase.from('meal_plans').insert(payload).select().single()
        if (error) throw error
        planId = plan.id
      }
      for (let i = 0; i < meals.length; i++) {
        const { data: meal, error: mErr } = await supabase
          .from('meals')
          .insert({ meal_plan_id: planId, name: meals[i].name, time_of_day: meals[i].time_of_day || null, sort_order: i })
          .select()
          .single()
        if (mErr) throw mErr
        if (meals[i].recipes.length) {
          await supabase.from('meal_plan_recipes').insert(
            meals[i].recipes.map(r => ({ meal_plan_id: planId, meal_id: meal.id, recipe_id: r.recipe_id, meal_type: r.meal_type || null }))
          )
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meal-plans-admin'] }); setEditorOpen(false) },
  })

  const deletePlan = useMutation({
    mutationFn: async (id: string) => { await supabase.from('meal_plans').delete().eq('id', id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans-admin'] }),
  })

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-muted)]">{mealPlans.length} meal plans</p>
        <Button onClick={openCreate}>+ Create meal plan</Button>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-disabled)]">Loading…</p> : (
        <Table>
          <thead>
            <tr><Th>Name</Th><Th>Valid from</Th><Th>Valid to</Th><Th>Status</Th><Th>{''}</Th></tr>
          </thead>
          <tbody>
            {mealPlans.map(p => (
              <tr key={p.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td className="text-[var(--text)] font-semibold">{p.name}</Td>
                <Td>{p.valid_from ?? '—'}</Td>
                <Td>{p.valid_to ?? '—'}</Td>
                <Td>{p.is_active ? <span className="text-green-400 text-xs">Active</span> : <span className="text-[var(--text-disabled)] text-xs">Inactive</span>}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => openEditPlan(p)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">Edit</button>
                    <button onClick={() => { if (confirm('Delete this meal plan?')) deletePlan.mutate(p.id) }} className="text-xs text-red-400 bg-transparent border-0 cursor-pointer">Delete</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Edit Meal Plan' : 'New Meal Plan'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => savePlan.mutate()} loading={savePlan.isPending} disabled={!form.name}>
              {editing ? 'Save changes' : 'Create plan'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Plan name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valid from" type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
            <Input label="Valid to" type="date" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>

          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Meal Slots</p>
            {meals.map((meal, mi) => (
              <div key={mi} className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 mb-2">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Input label="Meal name" value={meal.name} onChange={e => setMeals(ms => ms.map((m, i) => i === mi ? { ...m, name: e.target.value } : m))} placeholder="e.g. Breakfast" />
                  <Input label="Time" type="time" value={meal.time_of_day} onChange={e => setMeals(ms => ms.map((m, i) => i === mi ? { ...m, time_of_day: e.target.value } : m))} />
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    className="flex-1 bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-xs text-[var(--text)] outline-none"
                    defaultValue=""
                    onChange={e => {
                      if (!e.target.value) return
                      setMeals(ms => ms.map((m, i) => i === mi ? { ...m, recipes: [...m.recipes, { recipe_id: e.target.value, meal_type: 'breakfast' }] } : m))
                      e.target.value = ''
                    }}
                  >
                    <option value="" disabled>Add recipe…</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button onClick={() => setMeals(ms => ms.filter((_, i) => i !== mi))} className="text-xs text-red-400 bg-transparent border-0 cursor-pointer">Remove slot</button>
                </div>
                {meal.recipes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {meal.recipes.map((r, ri) => {
                      const recipe = recipes.find(rec => rec.id === r.recipe_id)
                      return (
                        <span key={ri} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-card)] border border-[var(--border)] rounded text-xs text-[var(--text-muted)]">
                          {recipe?.name ?? r.recipe_id}
                          <button onClick={() => setMeals(ms => ms.map((m, i) => i === mi ? { ...m, recipes: m.recipes.filter((_, j) => j !== ri) } : m))} className="text-[var(--text-disabled)] hover:text-red-400 bg-transparent border-0 cursor-pointer">✕</button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setMeals(ms => [...ms, { name: '', time_of_day: '', recipes: [] }])} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">
              + Add meal slot
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Nutrition root (sub-tabs) ───────────────────────────────────────────────

export default function Nutrition() {
  const [activeTab, setActiveTab] = useState<'recipes' | 'meal-plans'>('recipes')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-[var(--text)]">Nutrition</h1>
      </div>
      <div className="flex gap-0 mb-6 border-b border-[var(--border)]">
        {(['recipes', 'meal-plans'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px cursor-pointer bg-transparent transition-colors capitalize ${
              activeTab === tab
                ? 'border-[var(--text)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab === 'recipes' ? 'Recipes' : 'Meal Plans'}
          </button>
        ))}
      </div>
      {activeTab === 'recipes' ? <RecipesTab /> : <MealPlansTab />}
    </div>
  )
}
