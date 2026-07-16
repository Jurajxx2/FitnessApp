import { supabase } from '../lib/supabase'
import type { LogFoodDraft } from '../pages/nutrition/LogMeal'

export interface AnalyzedFood {
  name: string
  amount: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MealAnalysis {
  mealName: string
  foods: AnalyzedFood[]
}

let analysisDraftSequence = 0

function analyzedFoodToDraft(food: AnalyzedFood): LogFoodDraft {
  analysisDraftSequence += 1
  return {
    ...food,
    key: `analysis-ingredient-${analysisDraftSequence}`,
    baseAmount: food.amount > 0 ? food.amount : 1,
    baseUnit: food.unit,
    baseMacros: {
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
    },
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function analyzeMealPhoto(file: File): Promise<MealAnalysis> {
  const image_base64 = await fileToBase64(file)
  const { data, error } = await supabase.functions.invoke('analyze-meal-photo', {
    body: { image_base64, mime_type: file.type || 'image/jpeg' },
  })

  if (error) throw new Error('Fotografiu sa nepodarilo analyzovať. Skús to znova.')

  const analysis = data as MealAnalysis
  if (!analysis?.foods?.length || analysis.mealName === 'Unknown meal') {
    throw new Error('Na fotografii sa nepodarilo rozpoznať žiadne jedlo.')
  }
  return analysis
}

export function mergeAnalysis(current: LogFoodDraft[], analysis: MealAnalysis): LogFoodDraft[] {
  const analyzed = analysis.foods.map(analyzedFoodToDraft)
  const userRows = current.filter(item => item.name.trim())
  return [...userRows, ...analyzed]
}
