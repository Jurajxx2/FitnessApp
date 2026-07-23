import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  analysisPrompt,
  geminiGenerationConfig,
  MAX_IMAGE_BYTES,
  parseAnalysisRequest,
  parseMealAnalysis,
} from './logic.ts'

function validRequest(overrides: Record<string, unknown> = {}) {
  return {
    image_base64: 'aGVsbG8=',
    mime_type: 'image/jpeg',
    locale: 'sk',
    ...overrides,
  }
}

Deno.test('parseAnalysisRequest accepts the bounded Slovak contract', () => {
  assertEquals(parseAnalysisRequest(validRequest({ description: '  grilované bez oleja  ' })), {
    image_base64: 'aGVsbG8=',
    mime_type: 'image/jpeg',
    description: 'grilované bez oleja',
    locale: 'sk',
  })
})

Deno.test('parseAnalysisRequest rejects extra keys, unsupported media and oversized images', () => {
  assertEquals(parseAnalysisRequest(validRequest({ extra: true })), null)
  assertEquals(parseAnalysisRequest(validRequest({ mime_type: 'image/heic' })), null)
  const oversizedBase64 = 'a'.repeat(Math.ceil((MAX_IMAGE_BYTES + 1) / 3) * 4)
  assertEquals(parseAnalysisRequest(validRequest({ image_base64: oversizedBase64 })), null)
})

Deno.test('parseMealAnalysis accepts and normalizes the exact item contract', () => {
  assertEquals(parseMealAnalysis({ items: [{
    name: '  Kuracie prsia ', grams: 150, kcal: 247, protein_g: 46,
    carbs_g: 0, fat_g: 5, confidence: 0.91,
  }] }), { items: [{
    name: 'Kuracie prsia', grams: 150, kcal: 247, protein_g: 46,
    carbs_g: 0, fat_g: 5, confidence: 0.91,
  }] })
})

Deno.test('parseMealAnalysis accepts and trims a valid meal_name', () => {
  const item = {
    name: 'Kuracie prsia', grams: 150, kcal: 247, protein_g: 46,
    carbs_g: 0, fat_g: 5, confidence: 0.91,
  }
  assertEquals(parseMealAnalysis({ items: [item], meal_name: '  Kuracie s ryžou ' }), {
    items: [item],
    meal_name: 'Kuracie s ryžou',
  })
})

Deno.test('parseMealAnalysis without meal_name still returns just items', () => {
  const item = {
    name: 'Kuracie prsia', grams: 150, kcal: 247, protein_g: 46,
    carbs_g: 0, fat_g: 5, confidence: 0.91,
  }
  assertEquals(parseMealAnalysis({ items: [item] }), { items: [item] })
})

Deno.test('parseMealAnalysis omits empty or whitespace-only meal_name', () => {
  const item = {
    name: 'Kuracie prsia', grams: 150, kcal: 247, protein_g: 46,
    carbs_g: 0, fat_g: 5, confidence: 0.91,
  }
  assertEquals(parseMealAnalysis({ items: [item], meal_name: '' }), { items: [item] })
  assertEquals(parseMealAnalysis({ items: [item], meal_name: '   ' }), { items: [item] })
})

Deno.test('parseMealAnalysis rejects a non-string meal_name', () => {
  const item = {
    name: 'Kuracie prsia', grams: 150, kcal: 247, protein_g: 46,
    carbs_g: 0, fat_g: 5, confidence: 0.91,
  }
  assertEquals(parseMealAnalysis({ items: [item], meal_name: 42 }), null)
})

Deno.test('parseMealAnalysis rejects a meal_name longer than 120 chars', () => {
  const item = {
    name: 'Kuracie prsia', grams: 150, kcal: 247, protein_g: 46,
    carbs_g: 0, fat_g: 5, confidence: 0.91,
  }
  assertEquals(parseMealAnalysis({ items: [item], meal_name: 'a'.repeat(121) }), null)
})

Deno.test('parseMealAnalysis rejects partial, non-finite, out-of-range and extra output', () => {
  const valid = { name: 'Ryža', grams: 200, kcal: 260, protein_g: 5, carbs_g: 56, fat_g: 1, confidence: 0.8 }
  assertEquals(parseMealAnalysis({ items: [{ ...valid, confidence: Number.NaN }] }), null)
  assertEquals(parseMealAnalysis({ items: [{ ...valid, grams: 0 }] }), null)
  assertEquals(parseMealAnalysis({ items: [{ ...valid, unit: 'g' }] }), null)
  assertEquals(parseMealAnalysis({ items: [valid], mealName: 'Obed' }), null)
})

Deno.test('analysisPrompt includes Slovak description without changing the response contract', () => {
  const prompt = analysisPrompt('bez dresingu')
  assert(prompt.includes('bez dresingu'))
  assert(prompt.includes('po slovensky'))
  assert(prompt.includes('skrytý olej, maslo alebo cukor'))
})

Deno.test('analysisPrompt mentions meal_name', () => {
  const prompt = analysisPrompt('x')
  assert(prompt.includes('meal_name'))
})

Deno.test('Gemini config uses the live-compatible legacy generateContent envelope', () => {
  const config = geminiGenerationConfig()
  assertEquals(config, {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        items: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              grams: { type: 'NUMBER' },
              kcal: { type: 'NUMBER' },
              protein_g: { type: 'NUMBER' },
              carbs_g: { type: 'NUMBER' },
              fat_g: { type: 'NUMBER' },
              confidence: { type: 'NUMBER' },
            },
            required: ['name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence'],
          },
        },
        meal_name: { type: 'STRING' },
      },
      required: ['items', 'meal_name'],
    },
    temperature: 0.1,
  })

  const serialized = JSON.stringify(config)
  for (const unsupportedKeyword of ['minimum', 'maximum', 'maxItems', 'additionalProperties', 'responseFormat']) {
    assert(!serialized.includes(unsupportedKeyword))
  }
})
