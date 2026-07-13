import { describe, expect, it } from 'vitest'
import { getRecipePhotoPath } from './storage'

describe('getRecipePhotoPath', () => {
  it('extracts and decodes a recipe photo path from its public URL', () => {
    expect(getRecipePhotoPath(
      'https://project.supabase.co/storage/v1/object/public/recipe-photos/folder/My%20photo.jpg?download=1',
      'ignored.jpg',
    )).toBe('folder/My photo.jpg')
  })

  it('uses the stored file name when no public URL is present', () => {
    expect(getRecipePhotoPath(null, '/overnight-oats.jpg')).toBe('overnight-oats.jpg')
  })

  it('does not try to delete photos hosted outside the recipe bucket', () => {
    expect(getRecipePhotoPath('https://images.example.com/recipe.jpg', 'recipe.jpg')).toBeNull()
  })
})
