import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeMealPhoto, mergeAnalysis, parseMealAnalysis } from './photoAnalysis'
import { draftFromFood, emptyIngredient } from './logDraft'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke } } }))

beforeEach(() => invoke.mockReset())

const chicken = {
  name: 'Kuracie prsia', grams: 150, kcal: 247,
  protein_g: 46, carbs_g: 0, fat_g: 5, confidence: 0.91,
}

describe('parseMealAnalysis', () => {
  it('accepts the exact finite response contract', () => {
    expect(parseMealAnalysis({ items: [chicken] })).toEqual({ items: [chicken] })
  })

  it('rejects legacy, partial, additional and non-finite data', () => {
    expect(parseMealAnalysis({ mealName: 'Obed', foods: [] })).toBeNull()
    expect(parseMealAnalysis({ items: [{ ...chicken, confidence: Number.NaN }] })).toBeNull()
    expect(parseMealAnalysis({ items: [{ ...chicken, unit: 'g' }] })).toBeNull()
    const { confidence: _, ...withoutConfidence } = chicken
    expect(parseMealAnalysis({ items: [withoutConfidence] })).toBeNull()
  })

  it('accepts and trims a valid meal_name into mealName', () => {
    expect(parseMealAnalysis({ items: [chicken], meal_name: '  Kuracie prsia s ryžou ' }))
      .toEqual({ items: [chicken], mealName: 'Kuracie prsia s ryžou' })
  })

  it('omits mealName when meal_name is absent, empty, or whitespace-only', () => {
    expect(parseMealAnalysis({ items: [chicken] })).toEqual({ items: [chicken] })
    expect(parseMealAnalysis({ items: [chicken], meal_name: '' })).toEqual({ items: [chicken] })
    expect(parseMealAnalysis({ items: [chicken], meal_name: '   ' })).toEqual({ items: [chicken] })
  })

  it('rejects a non-string or overlong meal_name', () => {
    expect(parseMealAnalysis({ items: [chicken], meal_name: 42 })).toBeNull()
    expect(parseMealAnalysis({ items: [chicken], meal_name: 'x'.repeat(121) })).toBeNull()
  })
})

describe('analyzeMealPhoto', () => {
  it('sends the bounded image with Slovak locale and optional context', async () => {
    invoke.mockResolvedValue({ data: { items: [chicken] }, error: null })
    const file = new File(['photo'], 'meal.jpg', { type: 'image/jpeg' })

    await expect(analyzeMealPhoto(file, '  bez oleja  ')).resolves.toEqual({ items: [chicken] })
    expect(invoke).toHaveBeenCalledWith('analyze-meal-photo', {
      body: {
        image_base64: 'cGhvdG8=',
        mime_type: 'image/jpeg',
        locale: 'sk',
        description: 'bez oleja',
      },
    })
  })

  it('passes through the AI meal_name as mealName', async () => {
    invoke.mockResolvedValue({ data: { items: [chicken], meal_name: 'Kuracie prsia s ryžou' }, error: null })
    const file = new File(['photo'], 'meal.jpg', { type: 'image/jpeg' })

    await expect(analyzeMealPhoto(file)).resolves.toEqual({ items: [chicken], mealName: 'Kuracie prsia s ryžou' })
  })

  it('rejects invalid function data instead of partially applying it', async () => {
    invoke.mockResolvedValue({ data: { items: [{ ...chicken, confidence: 2 }] }, error: null })
    const file = new File(['photo'], 'meal.jpg', { type: 'image/jpeg' })

    await expect(analyzeMealPhoto(file)).rejects.toThrow('neplatné údaje')
  })

  it('preserves safe quota and timeout meaning from Edge error codes', async () => {
    const file = new File(['photo'], 'meal.jpg', { type: 'image/jpeg' })
    for (const [code, message] of [
      ['RATE_LIMITED', 'Dosiahol si limit analýz'],
      ['PROVIDER_TIMEOUT', 'Analýza trvala príliš dlho'],
    ] as const) {
      invoke.mockResolvedValue({
        data: null,
        error: { context: new Response(JSON.stringify({ error: { code } }), { status: 429 }) },
      })
      await expect(analyzeMealPhoto(file)).rejects.toThrow(message)
    }
  })
})

describe('mergeAnalysis', () => {
  it('replaces a single empty starter row with confidence-bearing AI rows', () => {
    const merged = mergeAnalysis([emptyIngredient()], { items: [chicken] })

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ name: 'Kuracie prsia', amount: 150, calories: 247, source: 'ai', confidence: 0.91 })
  })

  it('replaces earlier AI rows while preserving manual rows', () => {
    const manual = draftFromFood({ name: 'Ryža', amount: 100, unit: 'g', calories: 130, protein_g: 3, carbs_g: 28, fat_g: 0 }, 'manual')
    const oldAi = { ...draftFromFood({ name: 'Omáčka', amount: 20, unit: 'g', calories: 30, protein_g: 0, carbs_g: 2, fat_g: 2 }, 'ai'), confidence: 0.4 }
    const merged = mergeAnalysis([manual, oldAi], { items: [chicken] })

    expect(merged.map(item => item.name)).toEqual(['Ryža', 'Kuracie prsia'])
    expect(merged[0]).toBe(manual)
  })
})
