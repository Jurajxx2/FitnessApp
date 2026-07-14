import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, Sparkles } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, ConfirmDialog, EditorPage, EmptyState, FormSection, Input, Shimmer, StatRow, useNotice } from '../../components/ui'
import { getRecipePhotoPath, removeRecipePhoto, uploadRecipePhoto } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { ALLERGEN_OPTIONS, DIETARY_PATTERN_OPTIONS, MEAL_TYPE_OPTIONS } from '../../nutrition/constants'
import type { Recipe, RecipeDifficulty, RecipeIngredient } from '../../types/database'

export type IngredientDraft = Omit<RecipeIngredient, 'id' | 'recipe_id'>

export const blankIngredient = (index: number): IngredientDraft => ({
  name: '',
  quantity: null,
  unit: '',
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  sort_order: index,
})

export function calcMacros(ingredients: IngredientDraft[]) {
  return ingredients.reduce(
    (totals, ingredient) => ({
      calories: totals.calories + ingredient.calories,
      protein_g: totals.protein_g + ingredient.protein_g,
      carbs_g: totals.carbs_g + ingredient.carbs_g,
      fat_g: totals.fat_g + ingredient.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}

function ingredientHasData(ingredient: IngredientDraft) {
  return Boolean(ingredient.quantity)
    || ingredient.calories !== 0
    || ingredient.protein_g !== 0
    || ingredient.carbs_g !== 0
    || ingredient.fat_g !== 0
}

export function findBlankNamedRowsWithData(ingredients: IngredientDraft[]) {
  return ingredients
    .map((_, index) => index)
    .filter(index => !ingredients[index].name.trim() && ingredientHasData(ingredients[index]))
}

export function describeInvalidIngredientRows(rowIndexes: number[]) {
  if (!rowIndexes.length) return ''
  const rowNumbers = rowIndexes.map(index => index + 1).join(', ')
  const rowWord = rowIndexes.length === 1 ? 'Row' : 'Rows'
  const verb = rowIndexes.length === 1 ? 'has' : 'have'
  return `${rowWord} ${rowNumbers} ${verb} a quantity or macro value but no name. Give it a name or clear its values before saving.`
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value]
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return String(error)
}

class RecipePhotoCleanupError extends Error {
  readonly cause: unknown
  readonly cleanupError: unknown

  constructor(saveError: unknown, cleanupError: unknown) {
    super(`${describeError(saveError)} Photo cleanup also failed: ${describeError(cleanupError)}`)
    this.name = 'RecipePhotoCleanupError'
    this.cause = saveError
    this.cleanupError = cleanupError
  }
}

async function cleanupFailedRecipePhotoUpload(photoUrl: string, fileName: string): Promise<void> {
  const uploadedPath = getRecipePhotoPath(photoUrl, fileName)
  if (!uploadedPath) throw new Error('the uploaded recipe-photo path could not be determined')

  // uploadRecipePhoto uses upsert. Do not remove a path that the failed request
  // may have overwritten or that another recipe already shares.
  const { data: references, error: referencesError } = await supabase
    .from('recipes')
    .select('photo_url, photo_file_name')
  if (referencesError) throw referencesError

  const isReferenced = (references ?? []).some(reference =>
    getRecipePhotoPath(reference.photo_url, reference.photo_file_name) === uploadedPath
  )
  if (!isReferenced) await removeRecipePhoto(uploadedPath)
}

function GeneratorChipRow({ label, options, selected, onToggle }: {
  label: string; options: Array<{ value: string; adminLabel: string }>; selected: string[]; onToggle: (value: string) => void
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <button key={option.value} type="button" aria-pressed={selected.includes(option.value)} onClick={() => onToggle(option.value)}
            className={`min-h-9 cursor-pointer rounded-xl border px-3 text-xs font-semibold transition-colors ${selected.includes(option.value) ? 'border-accent bg-accent/10 text-text-primary' : 'border-outline bg-surface text-text-secondary hover:text-text-primary'}`}>
            {option.adminLabel}
          </button>
        ))}
      </div>
    </div>
  )
}

interface RecipeFormState {
  name: string
  description: string
  prep_time_min: string
  cook_time_min: string
  servings: string
  external_id: string
  photo_file_name: string
  difficulty: RecipeDifficulty | ''
  is_active: boolean
  featured: boolean
  eligible_for_generator: boolean
  macros_verified: boolean
  is_scalable: boolean
  allowed_portions: string
  fiber_g: string
  meal_types: string[]
  dietary_patterns: string[]
  allergens: string[]
}

const blankForm = (): RecipeFormState => ({
  name: '',
  description: '',
  prep_time_min: '',
  cook_time_min: '',
  servings: '1',
  external_id: '',
  photo_file_name: '',
  difficulty: '',
  is_active: true,
  featured: false,
  eligible_for_generator: false,
  macros_verified: false,
  is_scalable: true,
  allowed_portions: '',
  fiber_g: '',
  meal_types: [],
  dietary_patterns: [],
  allergens: [],
})

function useRecipeEditorData(id: string | undefined) {
  return useQuery({
    queryKey: ['recipe-admin', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [recipeResult, ingredientsResult] = await Promise.all([
        supabase.from('recipes').select('*').eq('id', id!).single(),
        supabase.from('recipe_ingredients').select('*').eq('recipe_id', id!).order('sort_order'),
      ])
      if (recipeResult.error) throw recipeResult.error
      if (ingredientsResult.error) throw ingredientsResult.error
      return { recipe: recipeResult.data as Recipe, ingredients: (ingredientsResult.data ?? []) as RecipeIngredient[] }
    },
  })
}

export default function RecipeEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const { data, isLoading, isError, error } = useRecipeEditorData(id)
  const [form, setForm] = useState<RecipeFormState>(blankForm())
  const [steps, setSteps] = useState<string[]>([''])
  const [tags, setTags] = useState('')
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([blankIngredient(0)])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!data) return
    const { recipe } = data
    setForm({
      name: recipe.name,
      description: recipe.description ?? '',
      prep_time_min: String(recipe.prep_time_min ?? ''),
      cook_time_min: String(recipe.cook_time_min ?? ''),
      servings: String(recipe.servings),
      external_id: recipe.external_id ?? '',
      photo_file_name: recipe.photo_file_name ?? '',
      difficulty: recipe.difficulty ?? '',
      is_active: recipe.is_active,
      featured: recipe.featured,
      eligible_for_generator: recipe.eligible_for_generator,
      macros_verified: recipe.macros_verified,
      is_scalable: recipe.is_scalable,
      allowed_portions: (recipe.allowed_portions ?? []).join(', '),
      fiber_g: recipe.fiber_g == null ? '' : String(recipe.fiber_g),
      meal_types: recipe.meal_types ?? [],
      dietary_patterns: recipe.dietary_patterns ?? [],
      allergens: recipe.allergens ?? [],
    })
    setSteps(recipe.steps?.length ? recipe.steps : [''])
    setTags(recipe.tags?.join(', ') ?? '')
    setIngredients(data.ingredients.length > 0 ? data.ingredients.map(ingredient => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit ?? '',
      calories: ingredient.calories,
      protein_g: ingredient.protein_g,
      carbs_g: ingredient.carbs_g,
      fat_g: ingredient.fat_g,
      sort_order: ingredient.sort_order,
    })) : [blankIngredient(0)])
    setPhotoPreview(recipe.photo_url ?? null)
  }, [data])

  useEffect(() => () => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  const invalidIngredientRows = findBlankNamedRowsWithData(ingredients)
  const ingredientsError = describeInvalidIngredientRows(invalidIngredientRows)
  const macros = calcMacros(ingredients.filter(ingredient => ingredient.name.trim()))
  const servings = Number(form.servings)
  const perServingMacros = Number.isFinite(servings) && servings > 0
    ? {
        calories: macros.calories / servings,
        protein_g: macros.protein_g / servings,
        carbs_g: macros.carbs_g / servings,
        fat_g: macros.fat_g / servings,
      }
    : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  const allowedPortions = form.allowed_portions.trim()
    ? form.allowed_portions.split(',').map(part => Number(part.trim()))
    : []
  const nonScalablePortionsInvalid = !form.is_scalable
    && allowedPortions.some(value => Number.isFinite(value) && !Number.isInteger(value))
  const ingredientNumbersInvalid = ingredients.some(ingredient =>
    [ingredient.quantity ?? 0, ingredient.calories, ingredient.protein_g, ingredient.carbs_g, ingredient.fat_g]
      .some(value => !Number.isFinite(value) || value < 0)
  )
  const metadataNumbersInvalid = !Number.isFinite(servings) || servings <= 0
    || (form.prep_time_min !== '' && (!Number.isFinite(Number(form.prep_time_min)) || Number(form.prep_time_min) < 0))
    || (form.cook_time_min !== '' && (!Number.isFinite(Number(form.cook_time_min)) || Number(form.cook_time_min) < 0))
    || (form.fiber_g !== '' && (!Number.isFinite(Number(form.fiber_g)) || Number(form.fiber_g) < 0))
    || allowedPortions.some(value => !Number.isFinite(value) || value <= 0)
    || nonScalablePortionsInvalid
  const formInvalid = !form.name.trim() || invalidIngredientRows.length > 0 || ingredientNumbersInvalid || metadataNumbersInvalid

  const saveRecipe = useMutation({
    mutationFn: async () => {
      if (invalidIngredientRows.length) throw new Error(ingredientsError)
      if (ingredientNumbersInvalid || metadataNumbersInvalid) throw new Error('Servings and allowed portions must be positive; all other numeric values must be finite and non-negative. Non-scalable recipes require whole allowed portions.')

      const validIngredients = ingredients.filter(ingredient => ingredient.name.trim())
      let photoUrl: string | undefined
      const uploadedFileName = photoFile ? (form.photo_file_name || photoFile.name) : null
      if (photoFile && uploadedFileName) photoUrl = await uploadRecipePhoto(photoFile, uploadedFileName)

      try {
        const { data: recipeId, error: saveError } = await supabase.rpc('admin_save_recipe_v2', {
          p_recipe_id: id ?? null,
          p_name: form.name,
          p_description: form.description,
          p_prep_time_min: form.prep_time_min ? Number(form.prep_time_min) : null,
          p_cook_time_min: form.cook_time_min ? Number(form.cook_time_min) : null,
          p_servings: Number(form.servings),
          p_external_id: form.external_id,
          p_photo_file_name: form.photo_file_name,
          p_photo_url: photoUrl ?? null,
          p_replace_photo: Boolean(photoFile),
          p_difficulty: form.difficulty || null,
          p_tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
          p_steps: steps.map(step => step.trim()).filter(Boolean),
          p_is_active: form.is_active,
          p_featured: form.featured,
          p_ingredients: validIngredients.map((ingredient, index) => ({ ...ingredient, sort_order: index })),
          p_eligible_for_generator: form.eligible_for_generator,
          p_macros_verified: form.macros_verified,
          p_is_scalable: form.is_scalable,
          p_allowed_portions: allowedPortions.length ? allowedPortions : null,
          p_fiber_g: form.fiber_g ? Number(form.fiber_g) : null,
          p_meal_types: form.meal_types,
          p_dietary_patterns: form.dietary_patterns,
          p_allergens: form.allergens,
        })
        if (saveError) throw saveError
        if (!recipeId) throw new Error('Recipe save returned no id')
        return recipeId as string
      } catch (saveError) {
        if (photoUrl && uploadedFileName) {
          try {
            await cleanupFailedRecipePhotoUpload(photoUrl, uploadedFileName)
          } catch (cleanupError) {
            throw new RecipePhotoCleanupError(saveError, cleanupError)
          }
        }
        throw saveError
      }
    },
    onSuccess: recipeId => {
      queryClient.invalidateQueries({ queryKey: ['recipes-admin'] })
      queryClient.invalidateQueries({ queryKey: ['recipe-admin', recipeId] })
      notify(isNew ? 'Recipe added.' : 'Recipe updated.')
      if (isNew) navigate(`/admin/nutrition/recipes/${recipeId}`, { replace: true })
    },
    onError: mutationError => notify(`Couldn’t save recipe: ${mutationError.message}`, 'error'),
  })

  const deleteRecipe = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Recipe is missing')
      if (!data?.recipe) throw new Error('Recipe details are unavailable')

      const photoPath = getRecipePhotoPath(data.recipe.photo_url, data.recipe.photo_file_name)
      if (photoPath) {
        const sharedReferenceQuery = data.recipe.photo_url
          ? supabase.from('recipes').select('id').eq('photo_url', data.recipe.photo_url).neq('id', id).limit(1)
          : supabase.from('recipes').select('id').eq('photo_file_name', data.recipe.photo_file_name).neq('id', id).limit(1)
        const { data: sharedReferences, error: sharedReferenceError } = await sharedReferenceQuery
        if (sharedReferenceError) throw sharedReferenceError
        if (!sharedReferences?.length) await removeRecipePhoto(photoPath)
      }

      const { data: deleted, error: deleteError } = await supabase.from('recipes').delete().eq('id', id).select('id').maybeSingle()
      if (deleteError) throw deleteError
      if (!deleted) throw new Error('No recipe was deleted')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes-admin'] })
      queryClient.removeQueries({ queryKey: ['recipe-admin', id] })
      notify('Recipe deleted.')
      navigate('/admin/nutrition?tab=recipes', { replace: true })
    },
    onError: mutationError => notify(`Couldn’t delete recipe: ${mutationError.message}`, 'error'),
  })

  function selectPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setPhotoFile(file)
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    if (!form.photo_file_name) setForm(current => ({ ...current, photo_file_name: file.name }))
  }

  function updateIngredient(index: number, field: keyof IngredientDraft, value: string | number | null) {
    setIngredients(current => current.map((ingredient, currentIndex) => currentIndex === index ? { ...ingredient, [field]: value } : ingredient))
  }

  if (!isNew && isLoading) {
    return <EditorPage backTo="/admin/nutrition?tab=recipes" backLabel="Back to recipes" eyebrow="Recipe library" title="Loading recipe…"><Shimmer className="h-96 w-full" /></EditorPage>
  }

  if (!isNew && (isError || !data)) {
    return <EditorPage backTo="/admin/nutrition?tab=recipes" backLabel="Back to recipes" eyebrow="Recipe library" title="Recipe unavailable"><EmptyState title="This recipe couldn’t be loaded" description={error?.message ?? 'It may have been removed.'} /></EditorPage>
  }

  return (
    <EditorPage
      backTo="/admin/nutrition?tab=recipes"
      backLabel="Back to recipes"
      eyebrow="Recipe library"
      title={isNew ? 'Add recipe' : form.name || 'Edit recipe'}
      description="Build the recipe as athletes will experience it: clear instructions, useful imagery, reliable serving information, and ingredient-derived macros."
      actions={
        <>
          {!isNew && <Button variant="danger" onClick={() => setDeleteDialogOpen(true)}>Delete recipe</Button>}
          <Button variant="ghost" onClick={() => navigate('/admin/nutrition?tab=recipes')}>Cancel</Button>
          <Button onClick={() => saveRecipe.mutate()} loading={saveRecipe.isPending} disabled={formInvalid}>{isNew ? 'Add recipe' : 'Save changes'}</Button>
        </>
      }
      aside={
        <>
          <Card className="overflow-hidden p-0">
            {photoPreview ? (
              <img src={photoPreview} alt="Recipe preview" className="aspect-video w-full object-cover" />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-surface"><ImageIcon size={30} className="text-text-secondary" aria-hidden="true" /></div>
            )}
            <div className="p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-accent">Recipe preview</p>
              <h2 className="mt-1 text-lg font-bold text-text-primary">{form.name || 'Untitled recipe'}</h2>
              <p className="mt-2 text-xs leading-5 text-text-secondary">{form.description || 'Add a short description that helps athletes understand the meal.'}</p>
            </div>
          </Card>

          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">Per serving</p>
            <StatRow items={[
              { label: 'Kcal', value: String(Math.round(perServingMacros.calories)) },
              { label: 'Protein', value: `${perServingMacros.protein_g.toFixed(1)}g` },
              { label: 'Carbs', value: `${perServingMacros.carbs_g.toFixed(1)}g` },
              { label: 'Fat', value: `${perServingMacros.fat_g.toFixed(1)}g` },
            ]} />
            <p className="mt-4 text-xs leading-5 text-text-secondary">Ingredient macros are whole-recipe totals; this summary and the saved recipe values are divided by servings.</p>
          </Card>

          <Card>
            <Sparkles size={19} className="text-accent" aria-hidden="true" />
            <div className="mt-3 space-y-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1" checked={form.is_active} onChange={event => setForm(current => ({ ...current, is_active: event.target.checked }))} />
                <span><span className="block text-sm font-semibold text-text-primary">Active recipe</span><span className="mt-1 block text-xs leading-5 text-text-secondary">Archived recipes remain in historical plans but are hidden from athlete discovery.</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 border-t border-outline-subtle pt-4">
                <input type="checkbox" className="mt-1" checked={form.featured} onChange={event => setForm(current => ({ ...current, featured: event.target.checked }))} />
                <span><span className="block text-sm font-semibold text-text-primary">Featured</span><span className="mt-1 block text-xs leading-5 text-text-secondary">Prioritize this recipe in featured athlete surfaces.</span></span>
              </label>
            </div>
          </Card>
        </>
      }
    >
      <FormSection title="Recipe details" description="Name and servings are required. Time values are optional and cannot be negative.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input label="Recipe name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Overnight oats" required autoFocus={isNew} /></div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Description</label>
            <textarea className="min-h-28 w-full resize-y rounded-xl border border-outline bg-surface px-3 py-2 text-sm leading-6 text-text-primary outline-none focus:border-accent" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="A high-protein breakfast that can be prepared the night before." />
          </div>
          <Input label="External ID" value={form.external_id} onChange={event => setForm(current => ({ ...current, external_id: event.target.value }))} placeholder="Stable import key" />
          <Input label="Tags" value={tags} onChange={event => setTags(event.target.value)} placeholder="high-protein, quick" />
          <Input label="Prep time (min)" type="number" min="0" value={form.prep_time_min} onChange={event => setForm(current => ({ ...current, prep_time_min: event.target.value }))} />
          <Input label="Cook time (min)" type="number" min="0" value={form.cook_time_min} onChange={event => setForm(current => ({ ...current, cook_time_min: event.target.value }))} />
          <Input label="Servings" type="number" min="1" value={form.servings} onChange={event => setForm(current => ({ ...current, servings: event.target.value }))} />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Difficulty</label>
            <select className="h-10 w-full rounded-xl border border-outline bg-surface px-3 text-sm capitalize text-text-primary outline-none focus:border-accent" value={form.difficulty} onChange={event => setForm(current => ({ ...current, difficulty: event.target.value as RecipeDifficulty | '' }))}>
              <option value="">None</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Preparation" description="Each step becomes a numbered instruction card in the athlete recipe view.">
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3 rounded-2xl border border-outline-subtle bg-surface p-4">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent">{index + 1}</span>
              <textarea className="min-h-20 min-w-0 flex-1 resize-y border-0 bg-transparent text-sm leading-6 text-text-primary outline-none placeholder:text-text-secondary" value={step} onChange={event => setSteps(current => current.map((value, currentIndex) => currentIndex === index ? event.target.value : value))} placeholder={`Describe step ${index + 1}`} />
              <button type="button" aria-label={`Remove step ${index + 1}`} onClick={() => setSteps(current => current.filter((_, currentIndex) => currentIndex !== index))} className="min-h-9 cursor-pointer self-start rounded-lg border-0 bg-transparent px-2 text-xs text-error hover:bg-error/10">Remove</button>
            </li>
          ))}
        </ol>
        <Button variant="ghost" className="mt-4" onClick={() => setSteps(current => [...current, ''])}>Add step</Button>
      </FormSection>

      <FormSection title="Photo" description="Upload the image used in recipe lists and the full recipe detail view.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {photoPreview ? <img src={photoPreview} alt="Recipe preview" className="aspect-video w-full rounded-2xl object-cover sm:w-56" /> : <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-outline bg-surface sm:w-56"><ImageIcon size={24} className="text-text-secondary" aria-hidden="true" /></div>}
          <div className="flex-1 space-y-3">
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={selectPhoto} />
            <Button variant="ghost" onClick={() => photoInputRef.current?.click()}>{photoPreview ? 'Change photo' : 'Choose photo'}</Button>
            <Input label="Stored file name" value={form.photo_file_name} onChange={event => setForm(current => ({ ...current, photo_file_name: event.target.value }))} placeholder="overnight-oats.jpg" />
          </div>
        </div>
      </FormSection>

      <FormSection title="Ingredients" description="Named rows are saved in order. Enter whole-recipe macro totals; the summary converts them to one serving.">
        {ingredientsError && <p role="alert" className="mb-4 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{ingredientsError}</p>}
        <div className="space-y-4">
          {ingredients.map((ingredient, index) => (
            <article key={index} className={`rounded-2xl border bg-surface p-4 ${invalidIngredientRows.includes(index) ? 'border-error' : 'border-outline-subtle'}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Ingredient {index + 1}</p>
                <button type="button" onClick={() => setIngredients(current => current.filter((_, currentIndex) => currentIndex !== index))} className="min-h-9 cursor-pointer rounded-lg border-0 bg-transparent px-2 text-xs text-error hover:bg-error/10">Remove</button>
              </div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
                <Input label="Name" value={ingredient.name} onChange={event => updateIngredient(index, 'name', event.target.value)} placeholder="Oats" />
                <Input label="Quantity" type="number" min="0" step="any" value={String(ingredient.quantity ?? '')} onChange={event => updateIngredient(index, 'quantity', event.target.value ? Number(event.target.value) : null)} />
                <Input label="Unit" value={ingredient.unit ?? ''} onChange={event => updateIngredient(index, 'unit', event.target.value)} placeholder="g, ml…" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Input label="Calories" type="number" min="0" step="any" value={String(ingredient.calories)} onChange={event => updateIngredient(index, 'calories', Number(event.target.value))} />
                <Input label="Protein (g)" type="number" min="0" step="any" value={String(ingredient.protein_g)} onChange={event => updateIngredient(index, 'protein_g', Number(event.target.value))} />
                <Input label="Carbs (g)" type="number" min="0" step="any" value={String(ingredient.carbs_g)} onChange={event => updateIngredient(index, 'carbs_g', Number(event.target.value))} />
                <Input label="Fat (g)" type="number" min="0" step="any" value={String(ingredient.fat_g)} onChange={event => updateIngredient(index, 'fat_g', Number(event.target.value))} />
              </div>
            </article>
          ))}
        </div>
        <Button variant="ghost" className="mt-4" onClick={() => setIngredients(current => [...current, blankIngredient(current.length)])}>Add ingredient</Button>
        {(ingredientNumbersInvalid || metadataNumbersInvalid) && <p role="alert" className="mt-4 text-sm text-error">Servings and allowed portions must be positive; all other numeric values must be finite and non-negative. Non-scalable recipes require whole allowed portions.</p>}
      </FormSection>

      <FormSection title="Generator" description="Only recipes marked eligible with verified macros are used by the meal-plan generator. Tag meal types so the recipe lands in the right slot.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={form.eligible_for_generator} onChange={event => setForm(current => ({ ...current, eligible_for_generator: event.target.checked }))} />
            <span><span className="block text-sm font-semibold text-text-primary">Eligible for generator</span><span className="mt-1 block text-xs text-text-secondary">Include this recipe in generated meal plans.</span></span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={form.macros_verified} onChange={event => setForm(current => ({ ...current, macros_verified: event.target.checked }))} />
            <span><span className="block text-sm font-semibold text-text-primary">Macros verified</span><span className="mt-1 block text-xs text-text-secondary">Confirm the per-serving macros are accurate.</span></span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={form.is_scalable} onChange={event => setForm(current => ({ ...current, is_scalable: event.target.checked }))} />
            <span><span className="block text-sm font-semibold text-text-primary">Scalable portions</span><span className="mt-1 block text-xs text-text-secondary">The generator may scale this recipe between 0.5× and 2×.</span></span>
          </label>
          <Input label="Allowed portions (comma-separated ×)" value={form.allowed_portions} onChange={event => setForm(current => ({ ...current, allowed_portions: event.target.value }))} placeholder="0.5, 1, 1.5, 2" />
          <Input label="Fiber per serving (g)" type="number" min="0" step="any" value={form.fiber_g} onChange={event => setForm(current => ({ ...current, fiber_g: event.target.value }))} />
        </div>
        <div className="mt-5 space-y-4">
          <GeneratorChipRow label="Meal types" options={MEAL_TYPE_OPTIONS} selected={form.meal_types} onToggle={value => setForm(current => ({ ...current, meal_types: toggleValue(current.meal_types, value) }))} />
          <GeneratorChipRow label="Dietary patterns" options={DIETARY_PATTERN_OPTIONS} selected={form.dietary_patterns} onToggle={value => setForm(current => ({ ...current, dietary_patterns: toggleValue(current.dietary_patterns, value) }))} />
          <GeneratorChipRow label="Contains allergens" options={ALLERGEN_OPTIONS} selected={form.allergens} onToggle={value => setForm(current => ({ ...current, allergens: toggleValue(current.allergens, value) }))} />
        </div>
      </FormSection>

      {saveRecipe.error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{saveRecipe.error.message}</p>}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete recipe permanently?"
        description={<>“{form.name}” and its unshared uploaded photo will be removed. Historical meal-plan entries keep their saved nutrition snapshot.</>}
        pending={deleteRecipe.isPending}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => deleteRecipe.mutate()}
      />
    </EditorPage>
  )
}
