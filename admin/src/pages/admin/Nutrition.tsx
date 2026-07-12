// admin/src/pages/admin/Nutrition.tsx
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { uploadRecipePhoto } from '../../lib/storage'
import { Button, Chip, ConfirmDialog, EmptyState, Input, Modal, PageHeader, SearchInput, Table, Th, Td, useNotice } from '../../components/ui'
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
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

function FoodsTab({ createRequest, onCreateRequestHandled }: { createRequest: boolean; onCreateRequestHandled: () => void }) {
  const qc = useQueryClient()
  const { notify } = useNotice()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const { data: foods = [], isLoading, isError } = useFoods(deferredSearch)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Food | null>(null)
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

  useEffect(() => {
    if (!createRequest) return
    openCreate()
    onCreateRequestHandled()
  }, [createRequest, onCreateRequestHandled])

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
      notify(editing ? 'Food updated.' : 'Food added.')
    },
    onError: error => notify(`Couldn’t save food: ${error.message}`, 'error'),
  })

  const deleteFood = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('foods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foods-admin'] })
      setDeleteTarget(null)
      notify('Food deleted.')
    },
    onError: error => notify(`Couldn’t delete food: ${error.message}`, 'error'),
  })

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-[var(--text-muted)]">{foods.length} foods</p>
          <SearchInput
            placeholder="Search foods…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            className="w-48 sm:w-64"
          />
        </div>
        <Button onClick={openCreate}>+ Add food</Button>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-disabled)]">Loading…</p> : isError ? (
        <EmptyState title="Foods couldn’t be loaded" description="Refresh the page to retry." />
      ) : foods.length === 0 ? (
        <EmptyState
          title={search ? 'No foods match this search' : 'No foods in the library yet'}
          description={search ? 'Try a different food or brand name.' : 'Add a verified food to make it available to athletes.'}
          action={!search ? <Button onClick={openCreate}>Add food</Button> : undefined}
        />
      ) : (
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
                    <button onClick={() => openEdit(f)} className="text-xs font-medium text-text-secondary hover:text-text-primary bg-transparent border-0 cursor-pointer">Edit</button>
                    <button onClick={() => setDeleteTarget(f)} className="text-xs font-medium text-error bg-transparent border-0 cursor-pointer">Delete</button>
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete food?"
        description={<>“{deleteTarget?.name}” will be permanently removed from the food library.</>}
        pending={deleteFood.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteFood.mutate(deleteTarget.id)}
      />
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

// A row is "meaningfully filled" if it carries any quantity or macro data — an
// entirely blank row (default new-row state) is fine to drop silently, but a
// row with data and no name must never be silently dropped from the save,
// since that would understate the recipe's saved macros vs. what the coach
// sees on screen.
function ingredientHasData(ingredient: IngredientDraft) {
  return Boolean(ingredient.quantity) || ingredient.calories !== 0 || ingredient.protein_g !== 0 || ingredient.carbs_g !== 0 || ingredient.fat_g !== 0
}

function findBlankNamedRowsWithData(ingredients: IngredientDraft[]) {
  return ingredients
    .map((_, index) => index)
    .filter(index => !ingredients[index].name.trim() && ingredientHasData(ingredients[index]))
}

function describeInvalidIngredientRows(rowIndexes: number[]) {
  if (!rowIndexes.length) return ''
  const rowNumbers = rowIndexes.map(index => index + 1).join(', ')
  const rowWord = rowIndexes.length === 1 ? 'Row' : 'Rows'
  const verb = rowIndexes.length === 1 ? 'has' : 'have'
  return `${rowWord} ${rowNumbers} ${verb} a quantity or macro value but no name. Give it a name or clear its values before saving.`
}

function useRecipes(search = '') {
  return useQuery<Recipe[]>({
    queryKey: ['recipes-admin', search],
    queryFn: async () => {
      let query = supabase.from('recipes').select('*').order('name')
      if (search) query = query.ilike('name', `%${search}%`)
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

function RecipesTab({ createRequest, onCreateRequestHandled }: { createRequest: boolean; onCreateRequestHandled: () => void }) {
  const qc = useQueryClient()
  const { notify } = useNotice()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const { data: recipes = [], isLoading, isError } = useRecipes(deferredSearch)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null)
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

  useEffect(() => {
    if (!createRequest) return
    openCreate()
    onCreateRequestHandled()
  }, [createRequest, onCreateRequestHandled])

  async function openEdit(r: Recipe) {
    setEditing(r)
    setForm({ name: r.name, description: r.description ?? '', prep_time_min: String(r.prep_time_min ?? ''), cook_time_min: String(r.cook_time_min ?? ''), servings: String(r.servings), external_id: r.external_id ?? '', photo_file_name: r.photo_file_name ?? '', difficulty: r.difficulty ?? '' })
    setSteps(r.steps?.length ? r.steps : [''])
    setTags(r.tags?.join(', ') ?? '')
    const { data, error } = await supabase.from('recipe_ingredients').select('*').eq('recipe_id', r.id).order('sort_order')
    if (error) {
      notify(`Couldn’t load ingredients: ${error.message}`, 'error')
      return
    }
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
      const invalidRows = findBlankNamedRowsWithData(ingredients)
      if (invalidRows.length) {
        throw new Error(describeInvalidIngredientRows(invalidRows))
      }

      const validIngredients = ingredients.filter(ingredient => ingredient.name.trim())
      const macros = calcMacros(validIngredients)

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
        if (validIngredients.length) {
          const { error: rInsertErr } = await supabase.from('recipe_ingredients').insert(validIngredients.map((ing, i) => ({ ...ing, recipe_id: editing.id, sort_order: i })))
          if (rInsertErr) throw rInsertErr
        }
      } else {
        const { data: r, error } = await supabase.from('recipes').insert(payload).select().single()
        if (error) throw error
        if (validIngredients.length) {
          const { error: ingredientError } = await supabase.from('recipe_ingredients').insert(validIngredients.map((ing, i) => ({ ...ing, recipe_id: r.id, sort_order: i })))
          if (ingredientError) throw ingredientError
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes-admin'] })
      setEditorOpen(false)
      notify(editing ? 'Recipe updated.' : 'Recipe added.')
    },
    onError: error => notify(`Couldn’t save recipe: ${error.message}`, 'error'),
  })

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes-admin'] })
      setDeleteTarget(null)
      notify('Recipe deleted.')
    },
    onError: error => notify(`Couldn’t delete recipe: ${error.message}`, 'error'),
  })

  const toggleFeatured = useMutation({
    mutationFn: async (r: Recipe) => {
      const { error } = await supabase.from('recipes').update({ featured: !r.featured }).eq('id', r.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes-admin'] })
      notify('Featured recipe updated.')
    },
    onError: error => notify(`Couldn’t update featured recipe: ${error.message}`, 'error'),
  })

  function updateIngredient(i: number, field: keyof IngredientDraft, value: string | number | null) {
    setIngredients(ings => ings.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing))
  }

  const macros = calcMacros(ingredients)
  const invalidIngredientRows = findBlankNamedRowsWithData(ingredients)
  const ingredientsError = describeInvalidIngredientRows(invalidIngredientRows)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--text-muted)]">{recipes.length} recipes</p>
          <SearchInput
            placeholder="Search recipes…"
            value={search}
            onChange={event => setSearch(event.target.value)}
            onClear={() => setSearch('')}
            className="w-full sm:w-64"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setPhotoUploadOpen(true)}>Upload photos</Button>
          <Button variant="ghost" onClick={() => setImportOpen(true)}>Import JSON</Button>
          <Button onClick={openCreate}>+ Add recipe</Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-disabled)]">Loading…</p> : isError ? (
        <EmptyState title="Recipes couldn’t be loaded" description="Refresh the page to retry." />
      ) : recipes.length === 0 ? (
        <EmptyState
          title={search ? 'No recipes match this search' : 'No recipes in the library yet'}
          description={search ? 'Try a different recipe name.' : 'Add your first reusable recipe or import a recipe file.'}
          action={!search ? <Button onClick={openCreate}>Add recipe</Button> : undefined}
        />
      ) : (
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
                    <button onClick={() => openEdit(r)} className="text-xs font-medium text-text-secondary hover:text-text-primary bg-transparent border-0 cursor-pointer">Edit</button>
                    <button onClick={() => setDeleteTarget(r)} className="text-xs font-medium text-error bg-transparent border-0 cursor-pointer">Delete</button>
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
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveRecipe.mutate()} loading={saveRecipe.isPending} disabled={!form.name || invalidIngredientRows.length > 0}>
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
            {ingredientsError && <p role="alert" className="text-sm text-error mb-2">{ingredientsError}</p>}
            {ingredients.map((ing, i) => (
              <div key={i} className={`bg-[var(--bg)] border rounded-lg p-3 mb-2 ${invalidIngredientRows.includes(i) ? 'border-error' : 'border-[var(--border)]'}`}>
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete recipe?"
        description={<>“{deleteTarget?.name}” will be removed from the recipe library and any plan references.</>}
        pending={deleteRecipe.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteRecipe.mutate(deleteTarget.id)}
      />
    </>
  )
}

// ─── Meal Plans ──────────────────────────────────────────────────────────────

function useMealPlans() {
  return useQuery<MealPlan[]>({
    queryKey: ['meal-plans-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meal_plans').select('*').order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

function usePlanAssignmentCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ['meal-plan-assignment-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_meal_plans').select('meal_plan_id')
      if (error) throw error
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
  const { notify } = useNotice()
  const [deleteTarget, setDeleteTarget] = useState<MealPlan | null>(null)

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plans-admin'] })
      qc.invalidateQueries({ queryKey: ['meal-plan-assignment-counts'] })
      setDeleteTarget(null)
      notify('Meal plan deleted.')
    },
    onError: error => notify(`Couldn’t delete meal plan: ${error.message}`, 'error'),
  })

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-[var(--text-muted)]">{mealPlans.length} meal plans</p>
        <Button onClick={() => navigate('/admin/nutrition/meal-plans/new')}>+ Create meal plan</Button>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-disabled)]">Loading…</p> : mealPlans.length === 0 ? (
        <EmptyState
          title="No meal plans yet"
          description="Create a weekly plan and assign it to athletes when it is ready."
          action={<Button onClick={() => navigate('/admin/nutrition/meal-plans/new')}>Create meal plan</Button>}
        />
      ) : (
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
                      onClick={() => setDeleteTarget(p)}
                      className="text-xs font-medium text-error bg-transparent border-0 cursor-pointer"
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete meal plan?"
        description={<>“{deleteTarget?.name}” will be permanently removed from all assigned athletes.</>}
        pending={deletePlan.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deletePlan.mutate(deleteTarget.id)}
      />
    </>
  )
}

// ─── Nutrition root (sub-tabs) ───────────────────────────────────────────────

export default function Nutrition() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab: 'recipes' | 'meal-plans' | 'foods' = requestedTab === 'meal-plans' || requestedTab === 'foods' ? requestedTab : 'recipes'
  const [createRequest, setCreateRequest] = useState<'recipe' | 'food' | null>(null)

  useEffect(() => {
    const requestedCreate = searchParams.get('new')
    if (requestedCreate !== 'recipe' && requestedCreate !== 'food') return
    setCreateRequest(requestedCreate)
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    next.set('tab', requestedCreate === 'food' ? 'foods' : 'recipes')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  function selectTab(tab: 'recipes' | 'meal-plans' | 'foods') {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Nutrition" description="Manage recipes, meal plans, and the food library." />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {(['recipes', 'meal-plans', 'foods'] as const).map(tab => (
          <Chip
            key={tab}
            onClick={() => selectTab(tab)}
            selected={activeTab === tab}
            className="capitalize"
          >
            {tab.replace('-', ' ')}
          </Chip>
        ))}
      </div>
      {activeTab === 'recipes' && <RecipesTab createRequest={createRequest === 'recipe'} onCreateRequestHandled={() => setCreateRequest(null)} />}
      {activeTab === 'meal-plans' && <MealPlansTab />}
      {activeTab === 'foods' && <FoodsTab createRequest={createRequest === 'food'} onCreateRequestHandled={() => setCreateRequest(null)} />}
    </div>
  )
}
