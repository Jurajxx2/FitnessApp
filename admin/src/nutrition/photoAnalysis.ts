import { supabase } from '../lib/supabase'
import { draftFromFood, type LogFoodDraft } from './logDraft'

export interface AnalyzedMealItem {
  name: string
  grams: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: number
}

export interface MealAnalysis {
  items: AnalyzedMealItem[]
}

const TOP_LEVEL_KEYS = ['items']
const ITEM_KEYS = ['name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence']

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function finiteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

export function parseMealAnalysis(value: unknown): MealAnalysis | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const object = value as Record<string, unknown>
  if (!exactKeys(object, TOP_LEVEL_KEYS) || !Array.isArray(object.items) || object.items.length > 25) return null

  const items: AnalyzedMealItem[] = []
  for (const valueItem of object.items) {
    if (typeof valueItem !== 'object' || valueItem === null || Array.isArray(valueItem)) return null
    const item = valueItem as Record<string, unknown>
    if (!exactKeys(item, ITEM_KEYS)) return null
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 120) return null
    if (!finiteInRange(item.grams, 0.1, 5000)) return null
    if (!finiteInRange(item.kcal, 0, 10000)) return null
    if (!finiteInRange(item.protein_g, 0, 1000)) return null
    if (!finiteInRange(item.carbs_g, 0, 1000)) return null
    if (!finiteInRange(item.fat_g, 0, 1000)) return null
    if (!finiteInRange(item.confidence, 0, 1)) return null
    items.push({
      name: item.name.trim(),
      grams: item.grams,
      kcal: item.kcal,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      confidence: item.confidence,
    })
  }
  return { items }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const ANALYSIS_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Prihlásenie vypršalo. Prihlás sa znova.',
  ACCESS_DENIED: 'Pre tento účet nie je analýza stravy dostupná.',
  INVALID_REQUEST: 'Fotografiu sa nepodarilo spracovať. Vyber inú.',
  PAYLOAD_TOO_LARGE: 'Fotografia je na analýzu príliš veľká.',
  NOT_CONFIGURED: 'Analýza fotografie momentálne nie je dostupná.',
  RATE_LIMITED: 'Dosiahol si limit analýz. Skús to neskôr.',
  PROVIDER_TIMEOUT: 'Analýza trvala príliš dlho. Skús to znova.',
  ANALYSIS_FAILED: 'Fotografiu sa nepodarilo analyzovať. Skús to znova.',
  INTERNAL_ERROR: 'Analýza fotografie momentálne nie je dostupná.',
}

async function analysisErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: { clone?: () => { json?: () => Promise<unknown> } } } | null)?.context
  try {
    const body = await context?.clone?.().json?.() as { error?: { code?: unknown } } | undefined
    const code = body?.error?.code
    if (typeof code === 'string' && ANALYSIS_ERROR_MESSAGES[code]) return ANALYSIS_ERROR_MESSAGES[code]
  } catch {
    // Supabase may have already consumed a non-JSON response; keep the safe fallback.
  }
  return 'Fotografiu sa nepodarilo analyzovať. Skús to znova.'
}

export async function analyzeMealPhoto(file: File, description?: string): Promise<MealAnalysis> {
  const imageBase64 = await fileToBase64(file)
  const { data, error } = await supabase.functions.invoke('analyze-meal-photo', {
    body: {
      image_base64: imageBase64,
      mime_type: file.type,
      locale: 'sk',
      ...(description?.trim() ? { description: description.trim() } : {}),
    },
  })

  if (error) throw new Error(await analysisErrorMessage(error))
  const analysis = parseMealAnalysis(data)
  if (!analysis) throw new Error('Analýza fotografie vrátila neplatné údaje. Skús to znova.')
  if (analysis.items.length === 0) throw new Error('Na fotografii sa nepodarilo rozpoznať žiadne jedlo.')
  return analysis
}

/** Re-analysis replaces only prior AI rows and preserves confirmed/manual rows. */
export function mergeAnalysis(current: LogFoodDraft[], analysis: MealAnalysis): LogFoodDraft[] {
  const preserved = current.filter(item => item.source !== 'ai' && item.name.trim())
  const analyzed = analysis.items.map(item => ({
    ...draftFromFood({
      name: item.name,
      amount: item.grams,
      unit: 'g',
      calories: item.kcal,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
    }, 'ai'),
    confidence: item.confidence,
  }))
  return [...preserved, ...analyzed]
}
