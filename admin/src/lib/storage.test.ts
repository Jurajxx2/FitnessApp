import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMealPhotoPath, getRecipePhotoPath, MAX_MEAL_PHOTO_BYTES, signedMealPhotoUrl, uploadMealPhoto, validateMealPhoto } from './storage'

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    storage: { from: mocks.from },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.from.mockReturnValue({ upload: mocks.upload, createSignedUrl: mocks.createSignedUrl })
  mocks.upload.mockResolvedValue({ error: null })
  mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/meal' }, error: null })
})

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

describe('private meal photos', () => {
  it('uploads to a deterministic owner path and returns the object path', async () => {
    const file = new File(['photo'], 'meal.webp', { type: 'image/webp' })

    await expect(uploadMealPhoto('user-1', 'log-1', file, { upsert: true }))
      .resolves.toBe('user-1/meal_log-1.webp')
    expect(mocks.upload).toHaveBeenCalledWith('user-1/meal_log-1.webp', file, {
      contentType: 'image/webp', upsert: true,
    })
  })

  it('normalizes current paths and legacy public or signed URLs', () => {
    expect(getMealPhotoPath('/user-1/meal_log-1.jpg')).toBe('user-1/meal_log-1.jpg')
    expect(getMealPhotoPath('https://project.supabase.co/storage/v1/object/public/meal-photos/user-1/My%20meal.jpg'))
      .toBe('user-1/My meal.jpg')
    expect(getMealPhotoPath('https://project.supabase.co/storage/v1/object/sign/meal-photos/user-1/meal.jpg?token=x'))
      .toBe('user-1/meal.jpg')
    expect(getMealPhotoPath('https://images.example.com/meal.jpg')).toBeNull()
  })

  it('creates a short-lived URL for a private object path', async () => {
    await expect(signedMealPhotoUrl('user-1/meal_log-1.jpg', 900)).resolves.toBe('https://signed.example/meal')
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('user-1/meal_log-1.jpg', 900)
  })
})
