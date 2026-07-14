export type SlotType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface GeneratorRecipe {
  id: string; name: string
  calories: number; protein_g: number; carbs_g: number; fat_g: number
  fiber_g: number | null; prep_time_min: number | null; cook_time_min: number | null
  meal_types: string[]; dietary_patterns: string[]; allergens: string[]
  is_active: boolean; eligible_for_generator: boolean; macros_verified: boolean
  is_scalable: boolean; allowed_portions: number[] | null
}

export interface MacroValues {
  calories: number; protein_g: number; carbs_g: number; fat_g: number
}

export interface GeneratorTarget extends MacroValues {
  calorie_tol_pct: number
  protein_tol_pct: number
  carbs_tol_pct: number
  fat_tol_pct: number
}

export interface GeneratorOptions {
  includeSnack: boolean
  mealDistribution: Partial<Record<SlotType, number>> | null
  dietaryPatterns: string[]; excludedAllergens: string[]
  maxPrepTimeMin: number | null; maxRecipeRepeatsPerWeek: number
  dislikedRecipeIds: string[]; favouriteRecipeIds: string[]; seed: number
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
    if (!candidate.is_active || !candidate.eligible_for_generator || !candidate.macros_verified) return false
    if (!candidate.meal_types.includes(slot)) return false
    if (options.dislikedRecipeIds.includes(candidate.id)) return false
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

export interface GeneratedSlot {
  slot: SlotType; recipeId: string; recipeName: string; portionMultiplier: number
  calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number | null
  locked: boolean
}
export interface GeneratedDay {
  dayOfWeek: number  // 0 = Monday … 6 = Sunday
  slots: GeneratedSlot[]
  totals: MacroValues
  withinTolerance: boolean
}
export interface GeneratorDiagnostics {
  poolSizePerSlot: Record<string, number>
  daysOutOfTolerance: number[]
  notes: string[]
}
export interface GeneratedPlan { days: GeneratedDay[]; score: number; diagnostics: GeneratorDiagnostics }

export function restorePinnedSlotLockState(
  generated: GeneratedPlan,
  previous: GeneratedPlan,
  swappedDayOfWeek: number,
  swappedSlot: SlotType,
): GeneratedPlan {
  const previousLockState = new Map<string, boolean>(
    previous.days.flatMap(day => day.slots.map(slot => [`${day.dayOfWeek}:${slot.slot}`, slot.locked] as const)),
  )
  return {
    ...generated,
    days: generated.days.map(day => ({
      ...day,
      slots: day.slots.map(slot => {
        if (day.dayOfWeek === swappedDayOfWeek && slot.slot === swappedSlot) return slot
        const key = `${day.dayOfWeek}:${slot.slot}`
        return previousLockState.has(key) ? { ...slot, locked: previousLockState.get(key)! } : slot
      }),
    })),
  }
}

export const KCAL_TOLERANCE = 0.05
export const PROTEIN_FLOOR = 0.95

function scaledSlot(slot: SlotType, recipe: GeneratorRecipe, multiplier: number): GeneratedSlot {
  return {
    slot, recipeId: recipe.id, recipeName: recipe.name, portionMultiplier: multiplier,
    calories: recipe.calories * multiplier, protein_g: recipe.protein_g * multiplier,
    carbs_g: recipe.carbs_g * multiplier, fat_g: recipe.fat_g * multiplier,
    fiber_g: recipe.fiber_g == null ? null : recipe.fiber_g * multiplier, locked: false,
  }
}

function dayTotals(slots: GeneratedSlot[]): MacroValues {
  return slots.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories, protein_g: acc.protein_g + item.protein_g,
      carbs_g: acc.carbs_g + item.carbs_g, fat_g: acc.fat_g + item.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )
}

function isWithinPercentTolerance(value: number, target: number, tolerancePct: number): boolean {
  if (![value, target, tolerancePct].every(Number.isFinite) || tolerancePct < 0) return false
  if (target === 0) return Math.abs(value) <= Number.EPSILON
  return Math.abs(value - target) / Math.abs(target) <= tolerancePct / 100 + Number.EPSILON
}

export function isWithinTargetTolerances(totals: MacroValues, target: GeneratorTarget): boolean {
  return isWithinPercentTolerance(totals.calories, target.calories, target.calorie_tol_pct)
    && isWithinPercentTolerance(totals.protein_g, target.protein_g, target.protein_tol_pct)
    && isWithinPercentTolerance(totals.carbs_g, target.carbs_g, target.carbs_tol_pct)
    && isWithinPercentTolerance(totals.fat_g, target.fat_g, target.fat_tol_pct)
}

// Nudge the most scalable un-locked slot so the day lands inside tolerance.
function adjustDay(slots: GeneratedSlot[], recipesById: Map<string, GeneratorRecipe>, target: GeneratorTarget): GeneratedSlot[] {
  const totals = dayTotals(slots)
  if (isWithinTargetTolerances(totals, target)) return slots
  const gap = target.calories - totals.calories
  let bestIndex = -1
  let bestKcalPerStep = 0
  slots.forEach((item, index) => {
    const source = recipesById.get(item.recipeId)
    if (!source || item.locked || !source.is_scalable || source.allowed_portions?.length) return
    if (source.calories > bestKcalPerStep) { bestKcalPerStep = source.calories; bestIndex = index }
  })
  if (bestIndex === -1) return slots
  const source = recipesById.get(slots[bestIndex].recipeId)!
  const current = slots[bestIndex].portionMultiplier
  const desired = current + gap / source.calories
  const snapped = Math.min(PORTION_MAX, Math.max(PORTION_MIN, Math.round(desired / PORTION_STEP) * PORTION_STEP))
  if (snapped === current) return slots
  return slots.map((item, index) => index === bestIndex ? scaledSlot(item.slot, source, snapped) : item)
}

export function generateWeek(
  recipes: GeneratorRecipe[],
  target: GeneratorTarget,
  options: GeneratorOptions,
  lockedSlots?: Map<string, GeneratedSlot>,
): GeneratedPlan {
  const rng = mulberry32(options.seed)
  const budgets = slotBudgets(target, options)
  const recipesById = new Map(recipes.map(item => [item.id, item]))
  const favouriteIds = new Set(options.favouriteRecipeIds)
  const usage = new Map<string, number>()
  const diagnostics: GeneratorDiagnostics = { poolSizePerSlot: {}, daysOutOfTolerance: [], notes: [] }

  for (const budget of budgets) {
    const size = filterPool(recipes, budget.slot, options).length
    diagnostics.poolSizePerSlot[budget.slot] = size
    if (size === 0) diagnostics.notes.push(`No eligible recipes for ${budget.slot}. Tag more recipes or relax filters.`)
    else if (size < 4) diagnostics.notes.push(`Only ${size} eligible recipes for ${budget.slot}; expect repetition.`)
  }

  // Count every lock that the day loop will consume up front, so selection on
  // earlier days already sees repeat usage from locks on later days.
  if (lockedSlots) {
    for (const [key, locked] of lockedSlots) {
      const [dayPart, slotPart] = key.split(':')
      const day = Number(dayPart)
      if (!Number.isInteger(day) || day < 0 || day > 6) continue
      if (!budgets.some(budget => budget.slot === slotPart)) continue
      usage.set(locked.recipeId, (usage.get(locked.recipeId) ?? 0) + 1)
    }
  }

  const days: GeneratedDay[] = []
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    let slots: GeneratedSlot[] = []
    for (const budget of budgets) {
      const lockKey = `${dayOfWeek}:${budget.slot}`
      const locked = lockedSlots?.get(lockKey)
      if (locked) {
        // Usage for locks was pre-counted above; do not increment again here.
        slots.push({ ...locked, locked: true })
        continue
      }
      const pool = filterPool(recipes, budget.slot, options)
      if (!pool.length) continue
      const scored = pool
        .map(candidate => {
          const multiplier = bestPortion(candidate, budget.calories)
          const score = scoreCandidate(candidate, multiplier, budget, {
            usedCount: usage.get(candidate.id) ?? 0,
            maxRepeats: options.maxRecipeRepeatsPerWeek,
            isFavourite: favouriteIds.has(candidate.id),
          })
          return { candidate, multiplier, score }
        })
        .filter(entry => entry.score !== Infinity)
        .sort((a, b) => a.score - b.score || a.candidate.id.localeCompare(b.candidate.id))
      if (!scored.length) {
        diagnostics.notes.push(`Day ${dayOfWeek + 1}: every ${budget.slot} candidate hit the repeat limit.`)
        continue
      }
      // Randomize among near-equal top candidates so regeneration varies.
      const best = scored[0].score
      const contenders = scored.filter(entry => entry.score <= best + 40)
      const chosen = contenders[Math.floor(rng() * contenders.length)]
      slots.push(scaledSlot(budget.slot, chosen.candidate, chosen.multiplier))
      usage.set(chosen.candidate.id, (usage.get(chosen.candidate.id) ?? 0) + 1)
    }
    slots = adjustDay(slots, recipesById, target)
    const totals = dayTotals(slots)
    const ok = isWithinTargetTolerances(totals, target)
    if (!ok) diagnostics.daysOutOfTolerance.push(dayOfWeek)
    days.push({ dayOfWeek, slots, totals, withinTolerance: ok })
  }

  const score = days.length
    ? days.reduce((sum, day) => sum + Math.abs(day.totals.calories - target.calories) / target.calories, 0) / days.length
    : 1
  return { days, score, diagnostics }
}
