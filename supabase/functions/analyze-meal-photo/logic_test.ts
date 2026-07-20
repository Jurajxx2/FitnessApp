import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { analysisPrompt, MAX_IMAGE_BYTES, parseAnalysisRequest, parseMealAnalysis } from './logic.ts'

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
