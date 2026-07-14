export type SlotType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface GeneratorRecipe {
  id: string; name: string
  calories: number; protein_g: number; carbs_g: number; fat_g: number
  fiber_g: number | null; prep_time_min: number | null; cook_time_min: number | null
  meal_types: string[]; dietary_patterns: string[]; allergens: string[]
  is_scalable: boolean; allowed_portions: number[] | null
}

export interface GeneratorTarget { calories: number; protein_g: number; carbs_g: number; fat_g: number }

export interface GeneratorOptions {
  includeSnack: boolean
  mealDistribution: Partial<Record<SlotType, number>> | null
  dietaryPatterns: string[]; excludedAllergens: string[]
  maxPrepTimeMin: number | null; maxRecipeRepeatsPerWeek: number
  favouriteRecipeIds: string[]; seed: number
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return function () {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEFAULT_DISTRIBUTION: Record<'plain' | 'snack', Array<{ slot: SlotType; pct: number }>> = {
  plain: [{ slot: 'breakfast', pct: 30 }, { slot: 'lunch', pct: 40 }, { slot: 'dinner', pct: 30 }],
  snack: [{ slot: 'breakfast', pct: 25 }, { slot: 'lunch', pct: 35 }, { slot: 'snack', pct: 10 }, { slot: 'dinner', pct: 30 }],
}

export function slotBudgets(target: GeneratorTarget, options: GeneratorOptions) {
  const layout = DEFAULT_DISTRIBUTION[options.includeSnack ? 'snack' : 'plain']
  const withOverrides = layout.map(item => ({
    slot: item.slot,
    pct: options.mealDistribution?.[item.slot] ?? item.pct,
  }))
  const totalPct = withOverrides.reduce((sum, item) => sum + item.pct, 0)
  return withOverrides.map(item => ({
    slot: item.slot,
    calories: (target.calories * item.pct) / totalPct,
    protein_g: (target.protein_g * item.pct) / totalPct,
  }))
}

export function filterPool(recipes: GeneratorRecipe[], slot: SlotType, options: GeneratorOptions): GeneratorRecipe[] {
  return recipes.filter(candidate => {
    if (!candidate.meal_types.includes(slot)) return false
    if (candidate.allergens.some(allergen => options.excludedAllergens.includes(allergen))) return false
    if (options.dietaryPatterns.length && !options.dietaryPatterns.every(pattern => candidate.dietary_patterns.includes(pattern))) return false
    if (options.maxPrepTimeMin != null) {
      const total = (candidate.prep_time_min ?? 0) + (candidate.cook_time_min ?? 0)
      if (total > options.maxPrepTimeMin) return false
    }
    return true
  })
}

const PORTION_MIN = 0.5
const PORTION_MAX = 2.0
const PORTION_STEP = 0.25

export function bestPortion(recipe: GeneratorRecipe, kcalBudget: number): number {
  if (recipe.calories <= 0) return 1
  if (recipe.allowed_portions?.length) {
    return [...recipe.allowed_portions].sort(
      (a, b) => Math.abs(a * recipe.calories - kcalBudget) - Math.abs(b * recipe.calories - kcalBudget),
    )[0]
  }
  if (!recipe.is_scalable) return 1
  const raw = kcalBudget / recipe.calories
  const snapped = Math.round(raw / PORTION_STEP) * PORTION_STEP
  return Math.min(PORTION_MAX, Math.max(PORTION_MIN, snapped))
}

export interface ScoreContext { usedCount: number; maxRepeats: number; isFavourite: boolean }

const PROTEIN_WEIGHT = 2      // kcal-equivalent weight per gram of protein deviation
const REPEAT_PENALTY = 120    // kcal-equivalent per prior use this week
const FAVOURITE_BONUS = 60    // kcal-equivalent

export function scoreCandidate(
  recipe: GeneratorRecipe,
  multiplier: number,
  budget: { calories: number; protein_g: number },
  context: ScoreContext,
): number {
  if (context.maxRepeats > 0 && context.usedCount >= context.maxRepeats) return Infinity
  const kcalDeviation = Math.abs(recipe.calories * multiplier - budget.calories)
  const proteinDeviation = Math.abs(recipe.protein_g * multiplier - budget.protein_g)
  return kcalDeviation
    + proteinDeviation * PROTEIN_WEIGHT
    + context.usedCount * REPEAT_PENALTY
    - (context.isFavourite ? FAVOURITE_BONUS : 0)
}
