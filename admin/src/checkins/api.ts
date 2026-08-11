import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { CheckInRow } from '../types/database'
import { prepareCheckInPhoto } from './imagePreparation'

const PHOTO_BUCKET = 'check-in-photos'

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

export type CheckInPhotoSlot = 'front' | 'side'
export type CheckInPhotoFiles = Partial<Record<CheckInPhotoSlot, File>>

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
  userId: string,
  weekOf: string,
  slot: CheckInPhotoSlot,
  file: File,
): Promise<string> {
  if (file.type !== 'image/jpeg') throw new Error('Check-in photo upload requires a prepared JPEG.')
  const path = `${userId}/checkin_${weekOf}_${slot}.jpg`
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: 'image/jpeg',
  })
  if (error) throw error
  return path
}

export async function removeCheckInPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths)
  if (error) throw error
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

export type CheckInSubmissionDependencies = {
  preparePhoto: typeof prepareCheckInPhoto
  uploadPhoto: typeof uploadCheckInPhoto
  removePhotos: typeof removeCheckInPhotos
  save: typeof saveCheckIn
}

const submissionDependencies: CheckInSubmissionDependencies = {
  preparePhoto: prepareCheckInPhoto,
  uploadPhoto: uploadCheckInPhoto,
  removePhotos: removeCheckInPhotos,
  save: saveCheckIn,
}

/**
 * Prepares both selected files before the first upload, uploads only on submit,
 * then persists their deterministic paths. If the sequence fails, only objects
 * that were not already referenced by this check-in are cleanup candidates.
 */
export async function submitCheckIn(
  userId: string,
  weekOf: string,
  draft: CheckInDraft,
  previousWeight: number | null,
  photoFiles: CheckInPhotoFiles,
  dependencies: CheckInSubmissionDependencies = submissionDependencies,
): Promise<CheckInRow> {
  const selections = (['front', 'side'] as const)
    .filter(slot => photoFiles[slot])
    .map(slot => ({ slot, file: photoFiles[slot]! }))

  // Preparation is deliberately complete before upload: one invalid photo must
  // not leave the other photo behind when no save attempt was made.
  const prepared = [] as Array<{ slot: CheckInPhotoSlot; file: File }>
  for (const selection of selections) {
    prepared.push({ slot: selection.slot, file: await dependencies.preparePhoto(selection.file) })
  }

  const nextDraft = { ...draft }
  const cleanupPaths: string[] = []
  try {
    for (const photo of prepared) {
      const path = await dependencies.uploadPhoto(userId, weekOf, photo.slot, photo.file)
      const pathKey = photo.slot === 'front' ? 'photoFrontPath' : 'photoSidePath'
      if (draft[pathKey] !== path) cleanupPaths.push(path)
      nextDraft[pathKey] = path
    }
    return await dependencies.save(userId, weekOf, nextDraft, previousWeight)
  } catch (error) {
    if (cleanupPaths.length > 0) {
      try {
        await dependencies.removePhotos(cleanupPaths)
      } catch (cleanupError) {
        logger.warn('Check-in save failed and uploaded photo cleanup also failed', cleanupError)
      }
    }
    throw error
  }
}
