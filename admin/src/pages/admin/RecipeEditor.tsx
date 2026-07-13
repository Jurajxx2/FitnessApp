import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, Sparkles } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, ConfirmDialog, EditorPage, EmptyState, FormSection, Input, Shimmer, StatRow, useNotice } from '../../components/ui'
import { uploadRecipePhoto } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
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
  const ingredientNumbersInvalid = ingredients.some(ingredient =>
    [ingredient.quantity ?? 0, ingredient.calories, ingredient.protein_g, ingredient.carbs_g, ingredient.fat_g]
      .some(value => !Number.isFinite(value) || value < 0)
  )
  const metadataNumbersInvalid = Number(form.servings) <= 0
    || (form.prep_time_min !== '' && Number(form.prep_time_min) < 0)
    || (form.cook_time_min !== '' && Number(form.cook_time_min) < 0)
  const formInvalid = !form.name.trim() || invalidIngredientRows.length > 0 || ingredientNumbersInvalid || metadataNumbersInvalid

  const saveRecipe = useMutation({
    mutationFn: async () => {
      if (invalidIngredientRows.length) throw new Error(ingredientsError)
      if (ingredientNumbersInvalid || metadataNumbersInvalid) throw new Error('Servings must be greater than zero and numeric values cannot be negative.')

      const validIngredients = ingredients.filter(ingredient => ingredient.name.trim())
      let photoUrl: string | undefined
      if (photoFile) photoUrl = await uploadRecipePhoto(photoFile, form.photo_file_name || photoFile.name)

      const { data: recipeId, error: saveError } = await supabase.rpc('admin_save_recipe', {
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
      })
      if (saveError) throw saveError
      return recipeId as string
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
            <StatRow items={[
              { label: 'Kcal', value: String(Math.round(macros.calories)) },
              { label: 'Protein', value: `${macros.protein_g.toFixed(1)}g` },
              { label: 'Carbs', value: `${macros.carbs_g.toFixed(1)}g` },
              { label: 'Fat', value: `${macros.fat_g.toFixed(1)}g` },
            ]} />
            <p className="mt-4 text-xs leading-5 text-text-secondary">Totals are calculated from named ingredient rows, matching the values stored on the recipe.</p>
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

      <FormSection title="Ingredients" description="Named rows are saved in order. Macro totals update immediately in the summary rail.">
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
        {(ingredientNumbersInvalid || metadataNumbersInvalid) && <p role="alert" className="mt-4 text-sm text-error">Servings must be greater than zero and numeric values cannot be negative.</p>}
      </FormSection>

      {saveRecipe.error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{saveRecipe.error.message}</p>}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete recipe permanently?"
        description={<>“{form.name}” will be removed from the recipe library. Historical meal-plan entries keep their saved nutrition snapshot.</>}
        pending={deleteRecipe.isPending}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => deleteRecipe.mutate()}
      />
    </EditorPage>
  )
}
