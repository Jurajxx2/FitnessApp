// supabase/functions/import-exercises/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WGER_BASE = 'https://wger.de/api/v2'
const ENGLISH_LANG = 2
const CZECH_LANG = 9
const PAGE_LIMIT = 100

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

async function wgerGet(path: string): Promise<any> {
  const res = await fetch(`${WGER_BASE}${path}`)
  if (!res.ok) throw new Error(`wger ${path} → ${res.status}`)
  return res.json()
}

async function wgerPaginate(path: string): Promise<any[]> {
  const results: any[] = []
  let url: string | null = `${WGER_BASE}${path}&limit=${PAGE_LIMIT}&offset=0`
  while (url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`wger paginate ${url} → ${res.status}`)
    const data = await res.json()
    results.push(...data.results)
    url = data.next ?? null
  }
  return results
}

async function downloadAndUpload(
  supabase: ReturnType<typeof createClient>,
  imageUrl: string,
  filename: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const { error } = await supabase.storage
      .from('exercises')
      .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('exercises').getPublicUrl(filename)
    return data.publicUrl
  } catch (err) {
    console.warn(`Image upload failed for ${filename}:`, err)
    return null
  }
}

async function importCategories(supabase: ReturnType<typeof createClient>): Promise<number> {
  const data = await wgerGet('/exercisecategory/?format=json&limit=100')
  const rows = data.results.map((c: any) => ({ id: c.id, name: c.name }))
  const { error } = await supabase.from('exercise_categories').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  return rows.length
}

async function importMuscles(supabase: ReturnType<typeof createClient>): Promise<number> {
  const data = await wgerGet('/muscle/?format=json&limit=100')
  const rows = data.results.map((m: any) => ({ id: m.id, name: m.name_en, is_front: m.is_front }))
  const { error } = await supabase.from('muscles').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  return rows.length
}

async function importEquipment(supabase: ReturnType<typeof createClient>): Promise<number> {
  const data = await wgerGet('/equipment/?format=json&limit=100')
  const rows = data.results.map((e: any) => ({ id: e.id, name: e.name }))
  const { error } = await supabase.from('equipment').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  return rows.length
}

async function importExercises(
  supabase: ReturnType<typeof createClient>,
): Promise<{ imported: number; skipped: number }> {
  const all = await wgerPaginate(`/exerciseinfo/?format=json&language=${ENGLISH_LANG}`)
  let imported = 0
  let skipped = 0

  for (const ex of all) {
    const enTranslation = ex.translations?.find((t: any) => t.language === ENGLISH_LANG)
    if (!enTranslation?.name) { skipped++; continue }
    const csTranslation = ex.translations?.find((t: any) => t.language === CZECH_LANG)

    let imageUrl: string | null = null
    const mainImage = ex.images?.find((img: any) => img.is_main) ?? ex.images?.[0]
    if (mainImage?.image) {
      const ext = mainImage.image.split('.').pop() ?? 'jpg'
      const filename = `${ex.id}-${enTranslation.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.${ext}`
      imageUrl = await downloadAndUpload(supabase, mainImage.image, filename)
    }

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

    if (exError) { skipped++; continue }

    const exerciseId = exerciseRow.id

    if ((ex.muscles?.length ?? 0) > 0 || (ex.muscles_secondary?.length ?? 0) > 0) {
      const muscleRows = [
        ...(ex.muscles ?? []).map((m: any) => ({ exercise_id: exerciseId, muscle_id: m.id, is_primary: true })),
        ...(ex.muscles_secondary ?? []).map((m: any) => ({ exercise_id: exerciseId, muscle_id: m.id, is_primary: false })),
      ]
      const { error: muscleErr } = await supabase.from('exercise_muscles').upsert(muscleRows, { onConflict: 'exercise_id,muscle_id' })
      if (muscleErr) console.warn(`Muscle upsert failed for exercise ${exerciseId}:`, muscleErr)
    }

    if (ex.equipment?.length > 0) {
      const eqRows = ex.equipment.map((e: any) => ({ exercise_id: exerciseId, equipment_id: e.id }))
      const { error: equipErr } = await supabase.from('exercise_equipment').upsert(eqRows, { onConflict: 'exercise_id,equipment_id' })
      if (equipErr) console.warn(`Equipment upsert failed for exercise ${exerciseId}:`, equipErr)
    }

    imported++
  }

  return { imported, skipped }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // JWT is already verified by Supabase gateway (verify_jwt: true).
  // Decode payload directly to check admin role without an extra network call.
  try {
    const token = authHeader.replace('Bearer ', '')
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    if (payload.app_metadata?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const categories = await importCategories(supabaseAdmin)
    const muscles = await importMuscles(supabaseAdmin)
    const equipment = await importEquipment(supabaseAdmin)
    const { imported, skipped } = await importExercises(supabaseAdmin)

    return new Response(
      JSON.stringify({ categories, muscles, equipment, imported, skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
