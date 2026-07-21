import type {
  MealLogFoodRow,
  MealLogRow,
  MealRow,
  MealType,
  RecipeRow,
} from '../types/database'
import { sumMacros, type Macros } from './calc'

export type LogFoodInput = {
  name: string
  amount: number | null
  unit: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export type EntrySource = 'manual' | 'favorite' | 'recent' | 'saved' | 'recipe' | 'ai'

export type LogFoodDraft = LogFoodInput & {
  key: string
  baseAmount: number
  baseUnit: string | null
  baseMacros: Macros
  source?: EntrySource
  confidence?: number
}

export type EntryDraft = LogFoodDraft

export interface MealDraft {
  mealName: string
  mealType: MealType | null
  loggedAt: string
  notes: string
  entries: LogFoodDraft[]
}

export interface DraftValidation {
  valid: boolean
  mealName: string | null
  mealType: string | null
  loggedAt: string | null
  entries: Array<{ index: number; fields: string[] }>
}

type Snapshot = Pick<
  MealLogFoodRow,
  'name' | 'amount' | 'unit' | 'amount_grams' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'
>

let draftSequence = 0

export function nextDraftKey(prefix = 'ingredient') {
  draftSequence += 1
  return `${prefix}-${draftSequence}`
}

export function draftFromFood(input: LogFoodInput, source?: EntrySource): LogFoodDraft {
  return {
    ...input,
    key: nextDraftKey(source),
    baseAmount: input.amount != null && input.amount > 0 ? input.amount : 1,
    baseUnit: input.unit,
    baseMacros: {
      calories: input.calories,
      protein_g: input.protein_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
    },
    source,
  }
}

export function emptyIngredient(): LogFoodDraft {
  return draftFromFood({
    name: '', amount: 100, unit: 'g', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
  }, 'manual')
}

/** Ignore only a pristine blank row; partially entered unnamed rows must block save. */
export function isUntouchedEmptyIngredient(draft: LogFoodDraft): boolean {
  const noPortion = draft.amount == null && draft.unit == null
  const defaultPortion = draft.amount === 100 && draft.unit === 'g'
  return !draft.name.trim()
    && draft.calories === 0
    && draft.protein_g === 0
    && draft.carbs_g === 0
    && draft.fat_g === 0
    && (noPortion || defaultPortion)
}

export function snapshotToDraft(
  snapshot: Snapshot,
  source: EntrySource,
): LogFoodDraft {
  const amount = snapshot.amount ?? snapshot.amount_grams ?? null
  const unit = snapshot.unit?.trim() || (snapshot.amount_grams == null ? null : 'g')
  return draftFromFood({
    name: snapshot.name,
    amount,
    unit,
    calories: snapshot.calories,
    protein_g: snapshot.protein_g,
    carbs_g: snapshot.carbs_g,
    fat_g: snapshot.fat_g,
  }, source)
}

/**
 * Ingredient values are whole-recipe totals, while recipe macros are per serving.
 * Materialize the selected servings as ordinary entries for logging.
 */
export function recipeIngredientsToDrafts(recipe: RecipeRow, servingsEaten = 1): LogFoodDraft[] {
  if (!Number.isFinite(servingsEaten) || servingsEaten <= 0) return []
  const ingredients = (recipe.recipe_ingredients ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
  if (ingredients.length === 0) {
    return [draftFromFood({
      name: recipe.name,
      amount: servingsEaten,
      unit: 'porcia',
      calories: recipe.calories * servingsEaten,
      protein_g: recipe.protein_g * servingsEaten,
      carbs_g: recipe.carbs_g * servingsEaten,
      fat_g: recipe.fat_g * servingsEaten,
    }, 'recipe')]
  }
  if (!Number.isFinite(recipe.servings) || recipe.servings <= 0) return []
  const factor = servingsEaten / recipe.servings
  return ingredients.map(ingredient => draftFromFood({
    name: ingredient.name,
    amount: (ingredient.quantity ?? 1) * factor,
    unit: ingredient.unit?.trim() || 'ks',
    calories: ingredient.calories * factor,
    protein_g: ingredient.protein_g * factor,
    carbs_g: ingredient.carbs_g * factor,
    fat_g: ingredient.fat_g * factor,
  }, 'recipe'))
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
  }, 'saved'))
}

export function rescaleDraftAmount(draft: LogFoodDraft, amount: number | null): LogFoodDraft {
  if (amount == null) return { ...draft, amount: null, unit: null }
  const unit = draft.unit ?? draft.baseUnit ?? 'g'
  if (unit !== draft.baseUnit || draft.baseAmount <= 0) return { ...draft, amount, unit }
  const factor = amount / draft.baseAmount
  return {
    ...draft,
    amount,
    unit,
    calories: draft.baseMacros.calories * factor,
    protein_g: draft.baseMacros.protein_g * factor,
    carbs_g: draft.baseMacros.carbs_g * factor,
    fat_g: draft.baseMacros.fat_g * factor,
  }
}

export function updateDraftMacro(draft: LogFoodDraft, field: keyof Macros, value: number): LogFoodDraft {
  const factor = draft.amount != null && draft.unit === draft.baseUnit && draft.baseAmount > 0
    ? draft.amount / draft.baseAmount
    : 1
  return {
    ...draft,
    [field]: value,
    baseMacros: { ...draft.baseMacros, [field]: factor > 0 ? value / factor : value },
  }
}

export function persistedFood(draft: LogFoodDraft): LogFoodInput {
  return {
    name: draft.name.trim(),
    amount: draft.amount,
    unit: draft.amount == null ? null : (draft.unit?.trim() || 'g'),
    calories: draft.calories,
    protein_g: draft.protein_g,
    carbs_g: draft.carbs_g,
    fat_g: draft.fat_g,
  }
}

export function mealDraftTotals(entries: LogFoodDraft[]): Macros {
  return sumMacros(entries)
}

export function amountGrams(amount: number | null, unit: string | null): number | null {
  return amount != null && unit?.trim().toLocaleLowerCase('sk-SK') === 'g' ? amount : null
}

export function validateMealDraft(draft: MealDraft): DraftValidation {
  const entryErrors = draft.entries.flatMap((entry, index) => {
    const fields: string[] = []
    if (!entry.name.trim()) fields.push('name')
    if (entry.amount != null && (!Number.isFinite(entry.amount) || entry.amount < 0)) fields.push('amount')
    if ((entry.amount == null) !== (entry.unit == null || !entry.unit.trim())) fields.push('unit')
    for (const field of ['calories', 'protein_g', 'carbs_g', 'fat_g'] as const) {
      if (!Number.isFinite(entry[field]) || entry[field] < 0) fields.push(field)
    }
    if (entry.confidence != null && (!Number.isFinite(entry.confidence) || entry.confidence < 0 || entry.confidence > 1)) {
      fields.push('confidence')
    }
    return fields.length ? [{ index, fields }] : []
  })
  const loggedAt = Number.isNaN(Date.parse(draft.loggedAt)) ? 'invalid' : null
  const mealName = draft.mealName.trim() ? null : 'required'
  const mealType = draft.mealType == null ? 'required' : null
  return {
    valid: mealName == null && mealType == null && loggedAt == null && draft.entries.length > 0 && entryErrors.length === 0,
    mealName,
    mealType,
    loggedAt,
    entries: entryErrors,
  }
}

/** Convert local date/time controls to the UTC instant persisted by Postgres. */
export function localDateTimeToIso(date: string, time: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match || !timeMatch) return null
  const [, yearText, monthText, dayText] = match
  const [, hourText, minuteText] = timeMatch
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (hour > 23 || minute > 59) return null
  const local = new Date(year, month - 1, day, hour, minute, 0, 0)
  if (
    local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== day
    || local.getHours() !== hour || local.getMinutes() !== minute
  ) return null
  return local.toISOString()
}

export function isoToLocalDateTime(iso: string): { date: string; time: string } | null {
  const value = new Date(iso)
  if (Number.isNaN(value.getTime())) return null
  const pad = (part: number) => String(part).padStart(2, '0')
  return {
    date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  }
}

export function dedupeRecentEntries(logs: MealLogRow[], limit = 20): LogFoodDraft[] {
  const sorted = logs.slice().sort((a, b) => Date.parse(b.logged_at) - Date.parse(a.logged_at))
  const seen = new Set<string>()
  const result: LogFoodDraft[] = []
  for (const log of sorted) {
    for (const item of log.meal_log_foods) {
      const key = `${item.name.trim().toLocaleLowerCase('sk-SK')}|${(item.unit ?? '').trim().toLocaleLowerCase('sk-SK')}`
      if (!item.name.trim() || seen.has(key)) continue
      seen.add(key)
      result.push(snapshotToDraft(item, 'recent'))
      if (result.length >= limit) return result
    }
  }
  return result
}

/** Build a friendly Slovak meal name from analysed/added item names. '' when there are none. */
export function suggestMealName(names: string[]): string {
  const clean = names.map(name => name.trim()).filter(Boolean)
  if (clean.length === 0) return ''
  if (clean.length === 1) return clean[0]
  if (clean.length === 2) return `${clean[0]} a ${clean[1]}`
  return `${clean[0]}, ${clean[1]} a ďalšie`
}
