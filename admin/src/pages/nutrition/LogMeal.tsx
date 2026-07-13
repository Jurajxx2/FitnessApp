import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Plus, Search, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useActiveMealPlan, useFoodSearch, useRecipe } from '../../nutrition/hooks'
import { useLogMeal, type LogFoodInput } from '../../nutrition/mutations'
import { scaleFood, sumMacros, type Macros } from '../../nutrition/calc'
import { validateMealPhoto } from '../../lib/storage'
import type { FoodRow, MealRow, RecipeRow } from '../../types/database'
import { Button, Card, Input, Shimmer, useNotice } from '../../components/ui'

type MacroField = keyof Macros

export type LogFoodDraft = LogFoodInput & {
  key: string
  baseAmount: number
  baseUnit: string
  baseMacros: Macros
}

let draftSequence = 0

function nextDraftKey() {
  draftSequence += 1
  return `ingredient-${draftSequence}`
}

export function draftFromFood(input: LogFoodInput): LogFoodDraft {
  return {
    ...input,
    key: nextDraftKey(),
    baseAmount: input.amount > 0 ? input.amount : 1,
    baseUnit: input.unit,
    baseMacros: {
      calories: input.calories,
      protein_g: input.protein_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
    },
  }
}

export function emptyIngredient(): LogFoodDraft {
  return draftFromFood({ name: '', amount: 100, unit: 'g', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
}

export function recipeIngredientsToDrafts(recipe: RecipeRow): LogFoodDraft[] {
  const ingredients = (recipe.recipe_ingredients ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
  if (ingredients.length === 0) {
    return [draftFromFood({
      name: recipe.name,
      amount: 1,
      unit: 'porcia',
      calories: recipe.calories,
      protein_g: recipe.protein_g,
      carbs_g: recipe.carbs_g,
      fat_g: recipe.fat_g,
    })]
  }
  return ingredients.map(ingredient => draftFromFood({
    name: ingredient.name,
    amount: ingredient.quantity ?? 1,
    unit: ingredient.unit?.trim() || 'ks',
    calories: ingredient.calories,
    protein_g: ingredient.protein_g,
    carbs_g: ingredient.carbs_g,
    fat_g: ingredient.fat_g,
  }))
}

export function mealFoodsToDrafts(meal: MealRow): LogFoodDraft[] {
  return meal.meal_foods.map(food => draftFromFood({
    name: food.name,
    amount: food.amount_grams,
    unit: 'g',
    calories: food.calories,
    protein_g: food.protein_g,
    carbs_g: food.carbs_g,
    fat_g: food.fat_g,
  }))
}

export function rescaleDraftAmount(draft: LogFoodDraft, amount: number): LogFoodDraft {
  if (draft.unit !== draft.baseUnit || draft.baseAmount <= 0) return { ...draft, amount }
  const factor = amount / draft.baseAmount
  return {
    ...draft,
    amount,
    calories: draft.baseMacros.calories * factor,
    protein_g: draft.baseMacros.protein_g * factor,
    carbs_g: draft.baseMacros.carbs_g * factor,
    fat_g: draft.baseMacros.fat_g * factor,
  }
}

function updateDraftMacro(draft: LogFoodDraft, field: MacroField, value: number): LogFoodDraft {
  const factor = draft.unit === draft.baseUnit && draft.baseAmount > 0
    ? draft.amount / draft.baseAmount
    : 1
  return {
    ...draft,
    [field]: value,
    baseMacros: {
      ...draft.baseMacros,
      [field]: factor > 0 ? value / factor : value,
    },
  }
}

function persistedFood(draft: LogFoodDraft): LogFoodInput {
  return {
    name: draft.name.trim(),
    amount: draft.amount,
    unit: draft.unit.trim() || 'g',
    calories: draft.calories,
    protein_g: draft.protein_g,
    carbs_g: draft.carbs_g,
    fat_g: draft.fat_g,
  }
}

export default function LogMeal() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recipeId = searchParams.get('recipeId') ?? ''
  const mealId = searchParams.get('mealId') ?? ''
  const recipeQuery = useRecipe(recipeId)
  const mealPlanQuery = useActiveMealPlan(Boolean(mealId) && !recipeId)
  const { notify } = useNotice()
  const [mealName, setMealName] = useState('')
  const [notes, setNotes] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<LogFoodDraft[]>(() => [emptyIngredient()])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)
  const prefillApplied = useRef(false)
  const { data: results, isFetching } = useFoodSearch(query)
  const logMeal = useLogMeal()

  useEffect(() => {
    if (prefillApplied.current) return

    if (recipeId && recipeQuery.data) {
      setMealName(recipeQuery.data.name)
      setItems(recipeIngredientsToDrafts(recipeQuery.data))
      prefillApplied.current = true
      return
    }

    if (mealId && mealPlanQuery.data) {
      const meal = mealPlanQuery.data.meals.find(candidate => candidate.id === mealId)
      if (meal) {
        setMealName(meal.name)
        setItems(mealFoodsToDrafts(meal))
      }
      prefillApplied.current = true
    }
  }, [mealId, mealPlanQuery.data, recipeId, recipeQuery.data])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null)
      return
    }
    const preview = URL.createObjectURL(photoFile)
    setPhotoPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [photoFile])

  function addFood(food: FoodRow) {
    const scaled = scaleFood(food, food.serving_size)
    setItems(current => [...current, draftFromFood(scaled)])
    setQuery('')
  }

  function updateItem(index: number, update: (draft: LogFoodDraft) => LogFoodDraft) {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? update(item) : item))
  }

  function removeItem(index: number) {
    setItems(current => current.length === 1 ? [emptyIngredient()] : current.filter((_, itemIndex) => itemIndex !== index))
  }

  function selectPhoto(file: File) {
    const validationError = validateMealPhoto(file)
    if (validationError) {
      setPhotoError(validationError)
      return
    }
    setPhotoError('')
    setPhotoFile(file)
  }

  async function save() {
    const foods = items.filter(item => item.name.trim()).map(persistedFood)
    if (!mealName.trim() || foods.length === 0) return

    try {
      const result = await logMeal.mutateAsync({
        mealName: mealName.trim(),
        foods,
        notes: notes.trim() || undefined,
        photoFile,
      })
      if (result.photoError) notify('Jedlo sa uložilo, ale fotografiu sa nepodarilo pripojiť.', 'error')
      else notify('Jedlo bolo uložené.', 'success')
      navigate('/nutrition')
    } catch {
      // Mutation state renders the actionable error without clearing the form.
    }
  }

  const totals = sumMacros(items.filter(item => item.name.trim()))
  const hasIngredient = items.some(item => item.name.trim())
  const isPrefilling = (recipeId && recipeQuery.isLoading) || (mealId && mealPlanQuery.isLoading)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Nutrition log</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.035em] text-text-primary">Zapísať jedlo</h1>
        <p className="mt-2 text-sm text-text-secondary">Uprav ingrediencie, porcie a výživové hodnoty podľa toho, čo si skutočne zjedol.</p>
      </div>

      {isPrefilling ? <Shimmer className="h-40 w-full" /> : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
          <div className="flex flex-col gap-5">
            <Card className="flex flex-col gap-5 p-5 sm:p-6">
              <Input id="mealName" label="Názov jedla" placeholder="napr. Obed" value={mealName} onChange={event => setMealName(event.target.value)} />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="mealNotes" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Poznámka</label>
                  <span className="text-[11px] text-text-secondary">voliteľné</span>
                </div>
                <textarea id="mealNotes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ako jedlo chutilo, úpravy porcie…" className="min-h-24 w-full resize-y rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent" />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Fotografia jedla</p>
                    <p className="mt-1 text-xs text-text-secondary">JPG, PNG alebo WebP · max. 10 MB</p>
                  </div>
                  {photoFile && <button type="button" onClick={() => setPhotoFile(null)} className="rounded-lg p-2 text-text-secondary hover:bg-surface-highest hover:text-error" aria-label="Odstrániť fotografiu"><X size={16} /></button>}
                </div>
                <button type="button" onClick={() => photoInput.current?.click()} className="flex min-h-28 w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-outline bg-surface text-sm font-semibold text-text-secondary hover:border-accent hover:text-text-primary">
                  {photoPreview ? <img src={photoPreview} alt="Náhľad jedla" className="h-48 w-full object-cover" /> : <><ImagePlus size={24} /><span>Pridať fotografiu</span></>}
                </button>
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) selectPhoto(file); event.target.value = '' }} />
                {photoError && <p role="alert" className="mt-2 text-xs text-error">{photoError}</p>}
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">Spolu</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ['Kcal', totals.calories, ''],
                    ['Bielk.', totals.protein_g, 'g'],
                    ['Sach.', totals.carbs_g, 'g'],
                    ['Tuky', totals.fat_g, 'g'],
                  ].map(([label, value, unit]) => (
                    <div key={String(label)} className="rounded-xl bg-surface-highest p-3 text-center">
                      <p className="text-lg font-extrabold text-text-primary">{Math.round(Number(value))}{unit}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <section className="flex flex-col gap-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-bold text-text-primary">Ingrediencie</h2>
                  <p className="mt-1 text-xs text-text-secondary">Každá položka má vlastnú porciu aj makrá.</p>
                </div>
                <span className="text-xs text-text-secondary">{items.filter(item => item.name.trim()).length} položiek</span>
              </div>

              {items.map((item, index) => (
                <Card key={item.key} className="p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Ingrediencia {index + 1}</p>
                    <button type="button" aria-label={`Odstrániť ingredienciu ${index + 1}`} onClick={() => removeItem(index)} className="rounded-lg p-2 text-text-secondary hover:bg-surface-highest hover:text-error"><X size={16} /></button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Input label="Názov" value={item.name} onChange={event => updateItem(index, draft => ({ ...draft, name: event.target.value }))} placeholder="napr. Ryža" />
                    </div>
                    <Input label="Množstvo" type="number" min={0} step="any" value={item.amount} onChange={event => updateItem(index, draft => rescaleDraftAmount(draft, Number(event.target.value)))} />
                    <Input label="Jednotka" value={item.unit} onChange={event => updateItem(index, draft => ({ ...draft, unit: event.target.value }))} placeholder="g, ml, ks…" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {([
                      ['calories', 'Kcal'],
                      ['protein_g', 'Bielkoviny'],
                      ['carbs_g', 'Sacharidy'],
                      ['fat_g', 'Tuky'],
                    ] as const).map(([field, label]) => (
                      <Input key={field} label={label} type="number" min={0} step="any" value={item[field]} onChange={event => updateItem(index, draft => updateDraftMacro(draft, field, Number(event.target.value)))} />
                    ))}
                  </div>
                </Card>
              ))}

              <Button variant="ghost" className="w-full" onClick={() => setItems(current => [...current, emptyIngredient()])}>
                <Plus size={17} aria-hidden="true" /> Pridať vlastnú ingredienciu
              </Button>
            </section>

            {logMeal.isError && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">Jedlo sa nepodarilo uložiť. Skontroluj pripojenie a skús to znova.</p>}
            <Button className="w-full sm:self-end sm:w-auto" loading={logMeal.isPending} disabled={!mealName.trim() || !hasIngredient} onClick={save}>
              <Camera size={17} aria-hidden="true" /> Uložiť jedlo
            </Button>
          </div>

          <Card className="flex flex-col gap-4 p-5 sm:p-6 lg:sticky lg:top-0">
            <div>
              <h2 className="font-bold text-text-primary">Vyhľadať potravinu</h2>
              <p className="mt-1 text-xs text-text-secondary">Výsledok pridáme ako ďalšiu upraviteľnú ingredienciu.</p>
            </div>
            <div className="relative">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-[2.05rem] text-text-secondary" />
              <Input id="foodSearch" label="Hľadať" placeholder="napr. kuracie prsia" value={query} onChange={event => setQuery(event.target.value)} className="pl-10" />
            </div>
            {isFetching && <Shimmer className="h-12 w-full" />}
            {(results ?? []).length > 0 && (
              <div className="flex max-h-[430px] flex-col divide-y divide-outline-subtle overflow-y-auto rounded-xl border border-outline-subtle">
                {results!.map(food => (
                  <button key={food.id} type="button" onClick={() => addFood(food)} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left hover:bg-surface-highest">
                    <span className="text-sm text-text-primary">{food.name}{food.brand ? ` · ${food.brand}` : ''}</span>
                    <span className="flex-shrink-0 text-xs text-text-secondary">{Math.round(food.calories)} kcal / {Math.round(food.serving_size)}{food.serving_unit}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
