import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { CheckInRow } from '../types/database'

const MAX_CHECK_IN_PHOTO_BYTES = 8 * 1024 * 1024
const ALLOWED_CHECK_IN_PHOTO_TYPES = new Set(['image/jpeg', 'image/png'])

export const checkInKeys = {
  all: (userId: string) => ['check-ins', userId] as const,
  page: (userId: string, page: number, pageSize: number) => ['check-ins', userId, 'page', page, pageSize] as const,
  week: (userId: string, weekOf: string) => ['check-ins', userId, weekOf] as const,
}

export interface CheckInDraft {
  weightKg: string
  energyLevel: number | null
  sleepQuality: number | null
  stressLevel: number | null
  trainingAdherence: string
  nutritionAdherence: number | null
  notes: string
  photoFrontPath: string | null
  photoSidePath: string | null
}

export function emptyCheckInDraft(weightKg = ''): CheckInDraft {
  return {
    weightKg,
    energyLevel: null,
    sleepQuality: null,
    stressLevel: null,
    trainingAdherence: '',
    nutritionAdherence: null,
    notes: '',
    photoFrontPath: null,
    photoSidePath: null,
  }
}

export function checkInToDraft(checkIn: CheckInRow): CheckInDraft {
  return {
    weightKg: checkIn.weight_kg?.toString() ?? '',
    energyLevel: checkIn.energy_level,
    sleepQuality: checkIn.sleep_quality,
    stressLevel: checkIn.stress_level,
    trainingAdherence: checkIn.training_adherence?.toString() ?? '',
    nutritionAdherence: checkIn.nutrition_adherence,
    notes: checkIn.notes ?? '',
    photoFrontPath: checkIn.photo_front_path,
    photoSidePath: checkIn.photo_side_path,
  }
}

export async function fetchCheckIns(userId: string, page = 0, pageSize = 12): Promise<{ data: CheckInRow[]; count: number }> {
  const { data, count, error } = await supabase
    .from('check_ins')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('week_of', { ascending: false })
    .order('id')
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (error) throw error
  return { data: (data ?? []) as CheckInRow[], count: count ?? 0 }
}

export async function fetchCheckInForWeek(userId: string, weekOf: string): Promise<CheckInRow | null> {
  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .eq('week_of', weekOf)
    .maybeSingle()
  if (error) throw error
  return data as CheckInRow | null
}

export async function uploadCheckInPhoto(
  weekOf: string,
  slot: 'front' | 'side',
  file: File,
): Promise<string> {
  if (file.size === 0 || file.size > MAX_CHECK_IN_PHOTO_BYTES) {
    throw new Error('Check-in photo must be between 1 byte and 8 MB')
  }
  if (!ALLOWED_CHECK_IN_PHOTO_TYPES.has(file.type)) {
    throw new Error('Check-in photo must be a JPEG or PNG image')
  }

  // The function validates the actual bytes, derives the owner from the JWT,
  // strips metadata, and performs the service-role write after reserving quota.
  const { data, error } = await supabase.functions.invoke('check-in-photo-upload', {
    body: file,
    headers: {
      'x-check-in-week': weekOf,
      'x-check-in-slot': slot,
    },
  })
  if (error) throw error
  const path = (data as { path?: unknown } | null)?.path
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('Check-in photo upload returned an invalid response')
  }
  return path
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const number = Number(value.replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

export async function saveCheckIn(
  userId: string,
  weekOf: string,
  draft: CheckInDraft,
  previousWeight: number | null,
): Promise<CheckInRow> {
  const weightKg = optionalNumber(draft.weightKg)
  const trainingAdherence = optionalNumber(draft.trainingAdherence)
  const payload = {
    user_id: userId,
    week_of: weekOf,
    weight_kg: weightKg,
    energy_level: draft.energyLevel,
    sleep_quality: draft.sleepQuality,
    stress_level: draft.stressLevel,
    training_adherence: trainingAdherence,
    nutrition_adherence: draft.nutritionAdherence,
    notes: draft.notes.trim() || null,
    photo_front_path: draft.photoFrontPath,
    photo_side_path: draft.photoSidePath,
  }

  const { data, error } = await supabase
    .from('check_ins')
    .upsert(payload, { onConflict: 'user_id,week_of' })
    .select('*')
    .single()
  if (error) throw error

  // Match mobile: progress weight logging is best-effort and only happens when
  // the current week's weight changed. A logging outage must not lose a check-in.
  if (weightKg !== null && weightKg !== previousWeight) {
    const { error: weightError } = await supabase.from('weight_entries').insert({
      user_id: userId,
      weight_kg: weightKg,
      recorded_at: weekOf,
      notes: null,
    })
    if (weightError) logger.warn('Check-in saved but weight history sync failed', weightError)
  }

  return data as CheckInRow
}
