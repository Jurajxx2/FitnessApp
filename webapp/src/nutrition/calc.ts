import type { FoodRow, Profile, ActivityLevel, Goal } from '../types/database'

export type Macros = { calories: number; protein_g: number; carbs_g: number; fat_g: number }

export function scaleFood(food: FoodRow, amount: number): Macros & { name: string; amount: number; unit: string } {
  const factor = food.serving_size > 0 ? amount / food.serving_size : 0
  return {
    name: food.name,
    amount,
    unit: food.serving_unit,
    calories: food.calories * factor,
    protein_g: food.protein_g * factor,
    carbs_g: food.carbs_g * factor,
    fat_g: food.fat_g * factor,
  }
}

export function sumMacros(foods: Array<Partial<Macros>>): Macros {
  return foods.reduce<Macros>(
    (acc, f) => ({
      calories: acc.calories + (f.calories ?? 0),
      protein_g: acc.protein_g + (f.protein_g ?? 0),
      carbs_g: acc.carbs_g + (f.carbs_g ?? 0),
      fat_g: acc.fat_g + (f.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )
}

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, active: 1.725, very_active: 1.9,
}
const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose_weight: 0.85, build_muscle: 1.10, get_stronger: 1.05, stay_fit: 1.0,
}

export function calcMacroTargets(
  p: Pick<Profile, 'weight_kg' | 'height_cm' | 'age' | 'goal' | 'activity_level' | 'gender'>,
): Macros | null {
  const { weight_kg, height_cm, age, activity_level, goal, gender } = p
  if (weight_kg == null || height_cm == null || age == null || activity_level == null) return null
  // Mifflin–St Jeor sex constant: +5 for male, -161 for female.
  // Fallback to +5 (male) when gender is unknown/null.
  const genderConstant = gender === 'female' ? -161 : 5
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + genderConstant
  const tdee = bmr * ACTIVITY_MULTIPLIER[activity_level]
  const calories = tdee * (goal ? GOAL_ADJUSTMENT[goal] : 1.0)
  const protein_g = weight_kg * 1.8
  const fat_g = (calories * 0.25) / 9
  const carbs_g = Math.max(0, (calories - protein_g * 4 - fat_g * 9) / 4)
  return { calories, protein_g, carbs_g, fat_g }
}
