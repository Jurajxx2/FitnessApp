import { describe, expect, it, vi } from 'vitest'
import {
  fitMealPhotoDimensions,
  MAX_PREPARED_MEAL_PHOTO_BYTES,
  prepareMealPhoto,
  type ImagePreparationAdapter,
} from './imagePreparation'

function adapterWithSizes(...sizes: number[]): ImagePreparationAdapter {
  let index = 0
  return {
    decode: vi.fn(async () => ({ source: {} as CanvasImageSource, width: 3200, height: 1800 })),
    encode: vi.fn(async () => new Blob([new Uint8Array(sizes[Math.min(index++, sizes.length - 1)])], { type: 'image/jpeg' })),
  }
}

describe('fitMealPhotoDimensions', () => {
  it('preserves aspect ratio while bounding the long edge', () => {
    expect(fitMealPhotoDimensions(3200, 1800)).toEqual({ width: 1600, height: 900 })
    expect(fitMealPhotoDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('prepareMealPhoto', () => {
  it('reuses an already bounded image file', async () => {
    const adapter: ImagePreparationAdapter = {
      decode: vi.fn(async () => ({ source: {} as CanvasImageSource, width: 800, height: 600 })),
      encode: vi.fn(),
    }
    const file = new File(['meal'], 'meal.webp', { type: 'image/webp' })

    await expect(prepareMealPhoto(file, adapter)).resolves.toBe(file)
    expect(adapter.encode).not.toHaveBeenCalled()
  })

  it('downscales and compresses an oversized image to one reusable JPEG', async () => {
    const adapter = adapterWithSizes(MAX_PREPARED_MEAL_PHOTO_BYTES + 1, 900_000)
    const file = new File([new Uint8Array(MAX_PREPARED_MEAL_PHOTO_BYTES + 1)], 'dinner.png', { type: 'image/png' })

    const prepared = await prepareMealPhoto(file, adapter)

    expect(prepared.name).toBe('dinner.jpg')
    expect(prepared.type).toBe('image/jpeg')
    expect(prepared.size).toBe(900_000)
    expect(adapter.encode).toHaveBeenNthCalledWith(1, expect.anything(), 1600, 900, 0.84)
    expect(adapter.encode).toHaveBeenNthCalledWith(2, expect.anything(), 1600, 900, 0.74)
  })

  it('rejects unsupported inputs before decoding', async () => {
    const adapter = adapterWithSizes(1)
    const file = new File(['x'], 'meal.heic', { type: 'image/heic' })

    await expect(prepareMealPhoto(file, adapter)).rejects.toThrow('JPG, PNG alebo WebP')
    expect(adapter.decode).not.toHaveBeenCalled()
  })
})
