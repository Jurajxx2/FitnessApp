import { describe, expect, it } from 'vitest'
import { getRecipePhotoPath, MAX_MEAL_PHOTO_BYTES, validateMealPhoto } from './storage'

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

describe('validateMealPhoto', () => {
  it('accepts supported image formats within the size limit', () => {
    expect(validateMealPhoto(new File(['photo'], 'meal.webp', { type: 'image/webp' }))).toBeNull()
  })

  it('rejects unsupported formats and oversized photos', () => {
    expect(validateMealPhoto(new File(['text'], 'meal.txt', { type: 'text/plain' }))).toContain('JPG')
    const oversized = new File([new Uint8Array(MAX_MEAL_PHOTO_BYTES + 1)], 'meal.jpg', { type: 'image/jpeg' })
    expect(validateMealPhoto(oversized)).toContain('10 MB')
  })
})
