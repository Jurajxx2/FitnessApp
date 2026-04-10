// admin/src/lib/storage.ts
import { supabase } from './supabase'

const RECIPE_PHOTOS_BUCKET = 'recipe-photos'

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
