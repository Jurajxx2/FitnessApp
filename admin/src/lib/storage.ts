// admin/src/lib/storage.ts
import { supabase } from './supabase'

const RECIPE_PHOTOS_BUCKET = 'recipe-photos'
const CHECK_IN_PHOTOS_BUCKET = 'check-in-photos'

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

export async function signedCheckInPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CHECK_IN_PHOTOS_BUCKET)
    .createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}
