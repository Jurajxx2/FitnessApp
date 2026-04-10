// scripts/import-exercises/import.js
// One-time import of exercises from wger.de into Supabase.
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node import.js
//
// Requires: npm install @supabase/supabase-js

import { createClient } from '@supabase/supabase-js'

const WGER_BASE = 'https://wger.de/api/v2'
const ENGLISH_LANG = 2
const CZECH_LANG = 9
const PAGE_LIMIT = 100

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim()
}

async function wgerGet(path) {
  const res = await fetch(`${WGER_BASE}${path}`)
  if (!res.ok) throw new Error(`wger ${path} → ${res.status}`)
  return res.json()
}

async function wgerPaginate(path) {
  const results = []
  let url = `${WGER_BASE}${path}&limit=${PAGE_LIMIT}&offset=0`
  while (url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`wger paginate ${url} → ${res.status}`)
    const data = await res.json()
    results.push(...data.results)
    url = data.next
  }
  return results
}

async function downloadAndUpload(imageUrl, filename) {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const { data, error } = await supabase.storage
      .from('exercises')
      .upload(filename, buffer, { contentType: 'image/png', upsert: true })
    if (error) throw error
    const { data: publicData } = supabase.storage.from('exercises').getPublicUrl(filename)
    return publicData.publicUrl
  } catch (e) {
    console.warn(`  image download failed: ${imageUrl} — ${e.message}`)
    return null
  }
}

// ── Import steps ─────────────────────────────────────────────────────────────

async function importCategories() {
  console.log('Importing categories…')
  const data = await wgerGet('/exercisecategory/?format=json&limit=100')
  const rows = data.results.map(c => ({ id: c.id, name: c.name }))
  const { error } = await supabase.from('exercise_categories').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  console.log(`  ✓ ${rows.length} categories`)
  return rows
}

async function importMuscles() {
  console.log('Importing muscles…')
  const data = await wgerGet('/muscle/?format=json&limit=100')
  const rows = data.results.map(m => ({ id: m.id, name: m.name_en, is_front: m.is_front }))
  const { error } = await supabase.from('muscles').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  console.log(`  ✓ ${rows.length} muscles`)
}

async function importEquipment() {
  console.log('Importing equipment…')
  const data = await wgerGet('/equipment/?format=json&limit=100')
  const rows = data.results.map(e => ({ id: e.id, name: e.name }))
  const { error } = await supabase.from('equipment').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  console.log(`  ✓ ${rows.length} equipment types`)
}

async function importExercises() {
  console.log('Importing exercises (this takes a while)…')
  const all = await wgerPaginate(`/exerciseinfo/?format=json&language=${ENGLISH_LANG}`)
  console.log(`  Fetched ${all.length} exercises from wger`)

  let imported = 0
  let skipped = 0

  for (const ex of all) {
    const enTranslation = ex.translations?.find(t => t.language === ENGLISH_LANG)
    if (!enTranslation?.name) {
      console.warn(`  SKIP wger#${ex.id}: no English translation`)
      skipped++
      continue
    }
    const csTranslation = ex.translations?.find(t => t.language === CZECH_LANG)

    // Download main image
    let imageUrl = null
    const mainImage = ex.images?.find(img => img.is_main) ?? ex.images?.[0]
    if (mainImage?.image) {
      const ext = mainImage.image.split('.').pop() ?? 'png'
      const filename = `${ex.id}-${enTranslation.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.${ext}`
      imageUrl = await downloadAndUpload(mainImage.image, filename)
    }

    // Insert exercise
    const { data: exerciseRow, error: exError } = await supabase
      .from('exercises')
      .upsert({
        name_en: enTranslation.name,
        description_en: stripHtml(enTranslation.description ?? ''),
        name_cs: csTranslation?.name ?? null,
        description_cs: csTranslation?.description ? stripHtml(csTranslation.description) : null,
        category_id: ex.category?.id ?? null,
        image_url: imageUrl,
        video_url: ex.videos?.[0]?.video ?? null,
        wger_id: ex.id,
        is_active: true,
      }, { onConflict: 'wger_id' })
      .select('id')
      .single()

    if (exError) {
      console.warn(`  ERROR wger#${ex.id}: ${exError.message}`)
      skipped++
      continue
    }

    const exerciseId = exerciseRow.id

    // Insert muscles
    if (ex.muscles?.length > 0 || ex.muscles_secondary?.length > 0) {
      const muscleRows = [
        ...(ex.muscles ?? []).map(m => ({ exercise_id: exerciseId, muscle_id: m.id, is_primary: true })),
        ...(ex.muscles_secondary ?? []).map(m => ({ exercise_id: exerciseId, muscle_id: m.id, is_primary: false })),
      ]
      await supabase.from('exercise_muscles').upsert(muscleRows, { onConflict: 'exercise_id,muscle_id' })
    }

    // Insert equipment
    if (ex.equipment?.length > 0) {
      const eqRows = ex.equipment.map(e => ({ exercise_id: exerciseId, equipment_id: e.id }))
      await supabase.from('exercise_equipment').upsert(eqRows, { onConflict: 'exercise_id,equipment_id' })
    }

    imported++
    if (imported % 50 === 0) console.log(`  … ${imported} imported so far`)
  }

  console.log(`  ✓ ${imported} exercises imported, ${skipped} skipped`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables')
    process.exit(1)
  }

  await importCategories()
  await importMuscles()
  await importEquipment()
  await importExercises()
  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
