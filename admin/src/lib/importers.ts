// admin/src/lib/importers.ts
import type { MealType } from '../types/database'

// ─── Shared ──────────────────────────────────────────────────────────────────

export interface ImportError {
  row: number
  field: string
  message: string
}

// ─── Recipe Import ────────────────────────────────────────────────────────────

export interface RecipeIngredientImport {
  name: string
  quantity: number | null
  unit: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface RecipeImportRow {
  external_id: string
  name: string
  description: string | null
  prep_time_min: number | null
  servings: number
  photo_file_name: string | null
  ingredients: RecipeIngredientImport[]
}

export type RecipeImportResult =
  | { ok: true; rows: RecipeImportRow[] }
  | { ok: false; errors: ImportError[] }

export function parseRecipeImport(json: unknown): RecipeImportResult {
  if (!Array.isArray(json)) {
    return { ok: false, errors: [{ row: -1, field: 'root', message: 'File must contain a JSON array' }] }
  }

  const errors: ImportError[] = []
  const rows: RecipeImportRow[] = []

  for (let i = 0; i < json.length; i++) {
    const item = json[i]
    if (typeof item !== 'object' || item === null) {
      errors.push({ row: i, field: 'root', message: 'Each item must be an object' })
      continue
    }

    const r = item as Record<string, unknown>

    if (!r.external_id || typeof r.external_id !== 'string') {
      errors.push({ row: i, field: 'external_id', message: 'external_id is required and must be a string' })
    }
    if (!r.name || typeof r.name !== 'string') {
      errors.push({ row: i, field: 'name', message: 'name is required and must be a string' })
    }
    if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
      errors.push({ row: i, field: 'ingredients', message: 'ingredients must be a non-empty array' })
    } else {
      for (let j = 0; j < r.ingredients.length; j++) {
        const ing = r.ingredients[j] as Record<string, unknown>
        if (!ing.name || typeof ing.name !== 'string') {
          errors.push({ row: i, field: `ingredients[${j}].name`, message: 'ingredient name is required' })
        }
        for (const macro of ['calories', 'protein_g', 'carbs_g', 'fat_g'] as const) {
          if (typeof ing[macro] !== 'number') {
            errors.push({ row: i, field: `ingredients[${j}].${macro}`, message: `${macro} must be a number` })
          }
        }
      }
    }

    if (errors.some(e => e.row === i)) continue

    const ingredients: RecipeIngredientImport[] = (r.ingredients as Record<string, unknown>[]).map(ing => ({
      name: ing.name as string,
      quantity: typeof ing.quantity === 'number' ? ing.quantity : null,
      unit: typeof ing.unit === 'string' ? ing.unit : null,
      calories: ing.calories as number,
      protein_g: ing.protein_g as number,
      carbs_g: ing.carbs_g as number,
      fat_g: ing.fat_g as number,
    }))

    rows.push({
      external_id: r.external_id as string,
      name: r.name as string,
      description: typeof r.description === 'string' ? r.description : null,
      prep_time_min: typeof r.prep_time_min === 'number' ? r.prep_time_min : null,
      servings: typeof r.servings === 'number' ? r.servings : 1,
      photo_file_name: typeof r.photo_file_name === 'string' ? r.photo_file_name : null,
      ingredients,
    })
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, rows }
}

export function validateRecipeImport(
  rows: RecipeImportRow[],
  existingExternalIds: string[],
): RecipeImportResult {
  const errors: ImportError[] = []
  const existingSet = new Set(existingExternalIds)
  const seenInFile = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (existingSet.has(row.external_id)) {
      errors.push({ row: i, field: 'external_id', message: `Recipe with external_id "${row.external_id}" already exists in the database` })
    }
    if (seenInFile.has(row.external_id)) {
      errors.push({ row: i, field: 'external_id', message: `Duplicate external_id "${row.external_id}" within the import file` })
    }
    seenInFile.add(row.external_id)
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, rows }
}

// ─── Meal Plan Import ─────────────────────────────────────────────────────────

export interface MealPlanRecipeImport {
  external_id: string
  meal_type: MealType | null
}

export interface MealImport {
  name: string
  time_of_day: string | null
  recipes: MealPlanRecipeImport[]
}

export interface MealPlanImportRow {
  name: string
  description: string | null
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
  meals: MealImport[]
}

export type MealPlanImportResult =
  | { ok: true; rows: MealPlanImportRow[] }
  | { ok: false; errors: ImportError[] }

const VALID_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export function parseMealPlanImport(json: unknown): MealPlanImportResult {
  if (!Array.isArray(json)) {
    return { ok: false, errors: [{ row: -1, field: 'root', message: 'File must contain a JSON array' }] }
  }

  const errors: ImportError[] = []
  const rows: MealPlanImportRow[] = []

  for (let i = 0; i < json.length; i++) {
    const item = json[i]
    if (typeof item !== 'object' || item === null) {
      errors.push({ row: i, field: 'root', message: 'Each item must be an object' })
      continue
    }

    const p = item as Record<string, unknown>

    if (!p.name || typeof p.name !== 'string') {
      errors.push({ row: i, field: 'name', message: 'name is required and must be a string' })
    }
    if (!Array.isArray(p.meals)) {
      errors.push({ row: i, field: 'meals', message: 'meals must be an array' })
    } else {
      for (let mi = 0; mi < p.meals.length; mi++) {
        const meal = p.meals[mi] as Record<string, unknown>
        if (!meal.name || typeof meal.name !== 'string') {
          errors.push({ row: i, field: `meals[${mi}].name`, message: 'meal name is required' })
        }
        if (Array.isArray(meal.recipes)) {
          for (let ri = 0; ri < meal.recipes.length; ri++) {
            const recipe = meal.recipes[ri] as Record<string, unknown>
            if (!recipe.external_id || typeof recipe.external_id !== 'string') {
              errors.push({ row: i, field: `meals[${mi}].recipes[${ri}].external_id`, message: 'recipe external_id is required' })
            }
            if (recipe.meal_type != null && !VALID_MEAL_TYPES.includes(recipe.meal_type as MealType)) {
              errors.push({ row: i, field: `meals[${mi}].recipes[${ri}].meal_type`, message: `meal_type must be one of: ${VALID_MEAL_TYPES.join(', ')}` })
            }
          }
        }
      }
    }

    if (errors.some(e => e.row === i)) continue

    const meals: MealImport[] = (p.meals as Record<string, unknown>[]).map(meal => ({
      name: meal.name as string,
      time_of_day: typeof meal.time_of_day === 'string' ? meal.time_of_day : null,
      recipes: Array.isArray(meal.recipes)
        ? (meal.recipes as Record<string, unknown>[]).map(r => ({
            external_id: r.external_id as string,
            meal_type: VALID_MEAL_TYPES.includes(r.meal_type as MealType) ? (r.meal_type as MealType) : null,
          }))
        : [],
    }))

    rows.push({
      name: p.name as string,
      description: typeof p.description === 'string' ? p.description : null,
      valid_from: typeof p.valid_from === 'string' ? p.valid_from : null,
      valid_to: typeof p.valid_to === 'string' ? p.valid_to : null,
      is_active: p.is_active === true,
      meals,
    })
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, rows }
}

export function validateMealPlanImport(
  rows: MealPlanImportRow[],
  knownExternalIds: string[],
): MealPlanImportResult {
  const errors: ImportError[] = []
  const knownSet = new Set(knownExternalIds)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    for (let mi = 0; mi < row.meals.length; mi++) {
      const meal = row.meals[mi]
      for (let ri = 0; ri < meal.recipes.length; ri++) {
        const ref = meal.recipes[ri]
        if (!knownSet.has(ref.external_id)) {
          errors.push({
            row: i,
            field: `meals[${mi}].recipes[${ri}].external_id`,
            message: `No recipe found with external_id "${ref.external_id}"`,
          })
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, rows }
}
