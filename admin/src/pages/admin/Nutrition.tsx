// admin/src/pages/admin/Nutrition.tsx
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { uploadRecipePhoto } from '../../lib/storage'
import { Button, Chip, Input, Modal, PageHeader, Table, Th, Td } from '../../components/ui'
import type { Recipe, RecipeIngredient, MealPlan, RecipeDifficulty, Food } from '../../types/database'
import RecipeImportModal from './RecipeImportModal'
import RecipePhotoUploadModal from './RecipePhotoUploadModal'

// ─── Foods ──────────────────────────────────────────────────────────────────

function useFoods(search: string) {
  return useQuery<Food[]>({
    queryKey: ['foods-admin', search],
    queryFn: async () => {
      let q = supabase.from('foods').select('*').order('name')
      if (search) q = q.ilike('name', `%${search}%`)
      const { data } = await q
      return data ?? []
    },
  })
}

function FoodsTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const { data: foods = [], isLoading } = useFoods(search)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)
  const [form, setForm] = useState({
    name: '',
    calories: '0',
    protein_g: '0',
    carbs_g: '0',
    fat_g: '0',
    serving_size: '100',
    serving_unit: 'g',
    brand: '',
    is_verified: true,
  })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', calories: '0', protein_g: '0', carbs_g: '0', fat_g: '0', serving_size: '100', serving_unit: 'g', brand: '', is_verified: true })
    setEditorOpen(true)
  }

  function openEdit(f: Food) {
    setEditing(f)
    setForm({
      name: f.name,
      calories: String(f.calories),
      protein_g: String(f.protein_g),
      carbs_g: String(f.carbs_g),
      fat_g: String(f.fat_g),
      serving_size: String(f.serving_size),
      serving_unit: f.serving_unit,
      brand: f.brand ?? '',
      is_verified: f.is_verified,
    })
    setEditorOpen(true)
  }

  const saveFood = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        calories: Number(form.calories),
        protein_g: Number(form.protein_g),
        carbs_g: Number(form.carbs_g),
        fat_g: Number(form.fat_g),
        serving_size: Number(form.serving_size),
        serving_unit: form.serving_unit,
        brand: form.brand || null,
        is_verified: form.is_verified,
      }
      if (editing) {
        const { error } = await supabase.from('foods').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('foods').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foods-admin'] })
      setEditorOpen(false)
    },
  })

  const deleteFood = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('foods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['foods-admin'] }),
  })

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-[var(--text-muted)]">{foods.length} foods</p>
          <Input
            placeholder="Search foods…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-48 sm:w-64"
          />
        </div>
        <Button onClick={openCreate}>+ Add food</Button>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-disabled)]">Loading…</p> : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th><Th>Brand</Th><Th>Calories</Th><Th>Protein</Th><Th>Carbs</Th><Th>Fat</Th><Th>Serving</Th><Th>Verified</Th><Th>{''}</Th>
            </tr>
          </thead>
          <tbody>
            {foods.map(f => (
              <tr key={f.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td className="text-[var(--text)] font-semibold">{f.name}</Td>
                <Td className="text-xs text-[var(--text-muted)]">{f.brand ?? '—'}</Td>
                <Td>{Math.round(f.calories)} kcal</Td>
                <Td>{f.protein_g}g</Td>
                <Td>{f.carbs_g}g</Td>
                <Td>{f.fat_g}g</Td>
                <Td className="text-xs">{f.serving_size}{f.serving_unit}</Td>
                <Td>{f.is_verified ? '✅' : '—'}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(f)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">Edit</button>
                    <button onClick={() => { if (confirm('Delete this food?')) deleteFood.mutate(f.id) }} className="text-xs text-red-400 bg-transparent border-0 cursor-pointer">Delete</button>
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
        title={editing ? 'Edit Food' : 'New Food'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveFood.mutate()} loading={saveFood.isPending} disabled={!form.name}>
              {editing ? 'Save changes' : 'Add food'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Food name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label="Brand / Manufacturer" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Optional" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Serving Size" type="number" value={form.serving_size} onChange={e => setForm(f => ({ ...f, serving_size: e.target.value }))} />
            <Input label="Serving Unit" value={form.serving_unit} onChange={e => setForm(f => ({ ...f, serving_unit: e.target.value }))} placeholder="g, ml, piece…" />
          </div>
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Input label="Calories" type="number" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
            <Input label="Protein" type="number" value={form.protein_g} onChange={e => setForm(f => ({ ...f, protein_g: e.target.value }))} />
            <Input label="Carbs" type="number" value={form.carbs_g} onChange={e => setForm(f => ({ ...f, carbs_g: e.target.value }))} />
            <Input label="Fat" type="number" value={form.fat_g} onChange={e => setForm(f => ({ ...f, fat_g: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={form.is_verified} onChange={e => setForm(f => ({ ...f, is_verified: e.target.checked }))} />
            Verified food (coach approved)
          </label>
        </div>
      </Modal>
    </>
  )
}

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
  const [form, setForm] = useState({ name: '', description: '', prep_time_min: '', cook_time_min: '', servings: '1', external_id: '', photo_file_name: '', difficulty: '' as RecipeDifficulty | '' })
  const [steps, setSteps] = useState<string[]>([''])
  const [tags, setTags] = useState<string>('')
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([blankIngredient(0)])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', prep_time_min: '', cook_time_min: '', servings: '1', external_id: '', photo_file_name: '', difficulty: '' })
    setIngredients([blankIngredient(0)])
    setSteps([''])
    setTags('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setEditorOpen(true)
  }

  async function openEdit(r: Recipe) {
    setEditing(r)
    setForm({ name: r.name, description: r.description ?? '', prep_time_min: String(r.prep_time_min ?? ''), cook_time_min: String(r.cook_time_min ?? ''), servings: String(r.servings), external_id: r.external_id ?? '', photo_file_name: r.photo_file_name ?? '', difficulty: r.difficulty ?? '' })
    setSteps(r.steps?.length ? r.steps : [''])
    setTags(r.tags?.join(', ') ?? '')
    const { data } = await supabase.from('recipe_ingredients').select('*').eq('recipe_id', r.id).order('sort_order')
    setIngredients(data?.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit ?? '', calories: i.calories, protein_g: i.protein_g, carbs_g: i.carbs_g, fat_g: i.fat_g, sort_order: i.sort_order })) ?? [blankIngredient(0)])
    setPhotoFile(null)
    setPhotoPreview(r.photo_url ?? null)
    setEditorOpen(true)
  }

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPhotoFile(file)
    if (file) {
      setPhotoPreview(URL.createObjectURL(file))
      if (!form.photo_file_name) setForm(f => ({ ...f, photo_file_name: file.name }))
    }
  }

  const saveRecipe = useMutation({
    mutationFn: async () => {
      const macros = calcMacros(ingredients)

      let photoUrl: string | undefined
      if (photoFile) {
        const fileName = form.photo_file_name || photoFile.name
        photoUrl = await uploadRecipePhoto(photoFile, fileName)
      }

      const payload: Record<string, unknown> = {
        name: form.name,
        description: form.description || null,
        prep_time_min: form.prep_time_min ? Number(form.prep_time_min) : null,
        cook_time_min: form.cook_time_min ? Number(form.cook_time_min) : null,
        servings: Number(form.servings),
        external_id: form.external_id || null,
        photo_file_name: form.photo_file_name || null,
        difficulty: form.difficulty || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        steps: steps.filter(s => s.trim()),
        ...macros,
        ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}),
      }

      if (editing) {
        const { error: rUpdateErr } = await supabase.from('recipes').update(payload).eq('id', editing.id)
        if (rUpdateErr) throw rUpdateErr
        const { error: rDeleteErr } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', editing.id)
        if (rDeleteErr) throw rDeleteErr
        if (ingredients.length) {
          const { error: rInsertErr } = await supabase.from('recipe_ingredients').insert(ingredients.map((ing, i) => ({ ...ing, recipe_id: editing.id, sort_order: i })))
          if (rInsertErr) throw rInsertErr
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

  const toggleFeatured = useMutation({
    mutationFn: async (r: Recipe) => {
      const { error } = await supabase.from('recipes').update({ featured: !r.featured }).eq('id', r.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes-admin'] }),
  })

  function updateIngredient(i: number, field: keyof IngredientDraft, value: string | number | null) {
    setIngredients(ings => ings.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing))
  }

  const macros = calcMacros(ingredients)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-[var(--text-muted)]">{recipes.length} recipes in library</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setPhotoUploadOpen(true)}>Upload photos</Button>
          <Button variant="ghost" onClick={() => setImportOpen(true)}>Import JSON</Button>
          <Button onClick={openCreate}>+ Add recipe</Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-disabled)]">Loading…</p> : (
        <Table>
          <thead>
            <tr>
              <Th>{''}</Th><Th>Name</Th><Th>ID</Th><Th>Difficulty</Th><Th>Tags</Th><Th>Featured</Th><Th>Calories</Th><Th>Protein</Th><Th>Carbs</Th><Th>Fat</Th><Th>Prep</Th><Th>{''}</Th>
            </tr>
          </thead>
          <tbody>
            {recipes.map(r => (
              <tr key={r.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td>
                  {r.photo_url
                    ? <img src={r.photo_url} alt={r.name} className="w-8 h-8 rounded object-cover" />
                    : <div className="w-8 h-8 rounded bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--text-disabled)] text-xs">?</div>
                  }
                </Td>
                <Td className="text-[var(--text)] font-semibold">{r.name}</Td>
                <Td className="text-[var(--text-muted)] text-xs font-mono">{r.external_id ?? '—'}</Td>
                <Td className="text-xs">{r.difficulty ?? '—'}</Td>
                <Td className="text-xs text-[var(--text-muted)]">{r.tags?.length ? r.tags.join(', ') : '—'}</Td>
                <Td>
                  <button
                    onClick={() => toggleFeatured.mutate(r)}
                    title={r.featured ? 'Remove from featured' : 'Feature on the app home'}
                    className={`text-sm bg-transparent border-0 cursor-pointer ${r.featured ? 'text-amber-400' : 'text-[var(--text-disabled)] hover:text-[var(--text-muted)]'}`}
                  >★</button>
                </Td>
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

      <RecipeImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <RecipePhotoUploadModal open={photoUploadOpen} onClose={() => setPhotoUploadOpen(false)} />

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
          <Input label="External ID" value={form.external_id} onChange={e => setForm(f => ({ ...f, external_id: e.target.value }))} placeholder="e.g. overnight-oats (stable import key)" />
          <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Prep (min)" type="number" value={form.prep_time_min} onChange={e => setForm(f => ({ ...f, prep_time_min: e.target.value }))} />
            <Input label="Cook (min)" type="number" value={form.cook_time_min} onChange={e => setForm(f => ({ ...f, cook_time_min: e.target.value }))} />
            <Input label="Servings" type="number" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">Difficulty</p>
              <select
                value={form.difficulty}
                onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as RecipeDifficulty | '' }))}
                className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none"
              >
                <option value="">— none —</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <Input label="Tags (comma separated)" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. high-protein, gluten-free" />
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Preparation Steps</p>
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2 mb-2 items-start">
                <span className="text-xs text-[var(--text-disabled)] pt-2 w-5 shrink-0">{i + 1}.</span>
                <textarea
                  value={step}
                  onChange={e => setSteps(ss => ss.map((s, idx) => idx === i ? e.target.value : s))}
                  placeholder={`Step ${i + 1}`}
                  rows={2}
                  className="flex-1 bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none resize-none"
                />
                <button onClick={() => setSteps(ss => ss.filter((_, idx) => idx !== i))} className="text-xs text-red-400 bg-transparent border-0 cursor-pointer pt-2">✕</button>
              </div>
            ))}
            <button onClick={() => setSteps(ss => [...ss, ''])} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer">
              + Add step
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Photo</p>
            <div className="flex items-center gap-3">
              {photoPreview
                ? <img src={photoPreview} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-[var(--border)]" />
                : <div className="w-16 h-16 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--text-disabled)] text-xs">No photo</div>
              }
              <div className="flex flex-col gap-1">
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoSelected} />
                <button onClick={() => photoInputRef.current?.click()} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border border-[var(--border)] rounded px-2 py-1 cursor-pointer">
                  {photoPreview ? 'Change photo' : 'Upload photo'}
                </button>
                <Input label="Photo file name" value={form.photo_file_name} onChange={e => setForm(f => ({ ...f, photo_file_name: e.target.value }))} placeholder="e.g. overnight-oats.jpg" />
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
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
                  <Input label="Qty" type="number" value={String(ing.quantity ?? '')} onChange={e => updateIngredient(i, 'quantity', e.target.value ? Number(e.target.value) : null)} />
                  <Input label="Unit" value={ing.unit ?? ''} onChange={e => updateIngredient(i, 'unit', e.target.value)} placeholder="g, ml…" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

function usePlanAssignmentCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ['meal-plan-assignment-counts'],
    queryFn: async () => {
      const { data } = await supabase.from('user_meal_plans').select('meal_plan_id')
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        counts[row.meal_plan_id] = (counts[row.meal_plan_id] ?? 0) + 1
      }
      return counts
    },
  })
}

function MealPlansTab() {
  const navigate = useNavigate()
  const { data: mealPlans = [], isLoading } = useMealPlans()
  const { data: assignmentCounts = {} } = usePlanAssignmentCounts()
  const qc = useQueryClient()

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      qc.invalidateQueries({ queryKey: ['meal-plan-assignment-counts'] })
    },
  })

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-[var(--text-muted)]">{mealPlans.length} meal plans</p>
        <Button onClick={() => navigate('/admin/nutrition/meal-plans/new')}>+ Create meal plan</Button>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-disabled)]">Loading…</p> : (
        <Table>
          <thead>
            <tr><Th>Name</Th><Th>Description</Th><Th>Assigned to</Th><Th>Status</Th><Th>{''}</Th></tr>
          </thead>
          <tbody>
            {mealPlans.map(p => (
              <tr key={p.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td className="text-[var(--text)] font-semibold">{p.name}</Td>
                <Td className="text-xs text-[var(--text-muted)]">{p.description ?? '—'}</Td>
                <Td className="text-xs text-[var(--text-muted)]">{assignmentCounts[p.id] ?? 0} users</Td>
                <Td>{p.is_active ? <span className="text-green-400 text-xs">Active</span> : <span className="text-[var(--text-disabled)] text-xs">Inactive</span>}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/admin/nutrition/meal-plans/${p.id}`)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this meal plan?')) deletePlan.mutate(p.id) }}
                      className="text-xs text-red-400 bg-transparent border-0 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}

// ─── Nutrition root (sub-tabs) ───────────────────────────────────────────────

export default function Nutrition() {
  const [activeTab, setActiveTab] = useState<'recipes' | 'meal-plans' | 'foods'>('recipes')

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Nutrition" description="Manage recipes, meal plans, and the food library." />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {(['recipes', 'meal-plans', 'foods'] as const).map(tab => (
          <Chip
            key={tab}
            onClick={() => setActiveTab(tab)}
            selected={activeTab === tab}
            className="capitalize"
          >
            {tab.replace('-', ' ')}
          </Chip>
        ))}
      </div>
      {activeTab === 'recipes' && <RecipesTab />}
      {activeTab === 'meal-plans' && <MealPlansTab />}
      {activeTab === 'foods' && <FoodsTab />}
    </div>
  )
}
