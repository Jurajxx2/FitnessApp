// admin/src/lib/storage.ts
import { supabase } from './supabase'

const RECIPE_PHOTOS_BUCKET = 'recipe-photos'
const CHECK_IN_PHOTOS_BUCKET = 'check-in-photos'
const MEAL_PHOTOS_BUCKET = 'meal-photos'

export const MAX_MEAL_PHOTO_BYTES = 10 * 1024 * 1024
export const MEAL_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Uploads a recipe photo to Supabase Storage.
 * Overwrites any existing file with the same name.
 * Returns the public URL of the uploaded file.
 */
export async function uploadRecipePhoto(file: File, fileName: string): Promise<string> {
  const { error } = await supabase.storage
    .from(RECIPE_PHOTOS_BUCKET)
    .upload(fileName, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage
    .from(RECIPE_PHOTOS_BUCKET)
    .getPublicUrl(fileName)

  return data.publicUrl
}

export function getRecipePhotoPath(photoUrl: string | null, fileName: string | null): string | null {
  if (photoUrl) {
    try {
      const marker = `/storage/v1/object/public/${RECIPE_PHOTOS_BUCKET}/`
      const pathname = new URL(photoUrl).pathname
      const markerIndex = pathname.indexOf(marker)
      if (markerIndex === -1) return null
      const encodedPath = pathname.slice(markerIndex + marker.length)
      return encodedPath ? decodeURIComponent(encodedPath) : null
    } catch {
      return null
    }
  }

  return fileName?.replace(/^\/+/, '') || null
}

export async function removeRecipePhoto(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(RECIPE_PHOTOS_BUCKET)
    .remove([path])

  if (error) throw error
}

export function validateMealPhoto(file: File): string | null {
  if (!MEAL_PHOTO_TYPES.includes(file.type as typeof MEAL_PHOTO_TYPES[number])) {
    return 'Vyber fotografiu vo formáte JPG, PNG alebo WebP.'
  }
  if (file.size > MAX_MEAL_PHOTO_BYTES) {
    return 'Fotografia môže mať najviac 10 MB.'
  }
  return null
}

export async function uploadMealPhoto(userId: string, mealLogId: string, file: File, options?: { upsert?: boolean }): Promise<string> {
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/meal_${mealLogId}.${extension}`
  const { error } = await supabase.storage
    .from(MEAL_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: options?.upsert ?? false })

  if (error) throw error

  return path
}

/** Accepts both the current private object path and legacy public/signed URLs. */
export function getMealPhotoPath(pathOrUrl: string): string | null {
  const raw = pathOrUrl.trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, '') || null

  try {
    const pathname = new URL(raw).pathname
    const markers = [
      `/storage/v1/object/public/${MEAL_PHOTOS_BUCKET}/`,
      `/storage/v1/object/sign/${MEAL_PHOTOS_BUCKET}/`,
      `/storage/v1/object/authenticated/${MEAL_PHOTOS_BUCKET}/`,
    ]
    const marker = markers.find(candidate => pathname.includes(candidate))
    if (!marker) return null
    const encodedPath = pathname.slice(pathname.indexOf(marker) + marker.length)
    return encodedPath ? decodeURIComponent(encodedPath) : null
  } catch {
    return null
  }
}

export async function signedMealPhotoUrl(pathOrUrl: string, expiresIn = 3600): Promise<string | null> {
  const path = getMealPhotoPath(pathOrUrl)
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(MEAL_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error) return null
  return data.signedUrl
}

export async function removeMealPhoto(pathOrUrl: string): Promise<void> {
  const path = getMealPhotoPath(pathOrUrl)
  if (!path) return

  const { error } = await supabase.storage.from(MEAL_PHOTOS_BUCKET).remove([path])
  if (error) throw error
}

export async function signedCheckInPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CHECK_IN_PHOTOS_BUCKET)
    .createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}
