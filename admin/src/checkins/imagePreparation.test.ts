import { describe, expect, it, vi } from 'vitest'
import {
  fitCheckInPhotoDimensions,
  MAX_PREPARED_CHECK_IN_PHOTO_BYTES,
  prepareCheckInPhoto,
  type CheckInImagePreparationAdapter,
} from './imagePreparation'

function adapterWithSizes(...sizes: number[]): CheckInImagePreparationAdapter {
  let index = 0
  return {
    decode: vi.fn(async () => ({ source: {} as CanvasImageSource, width: 4000, height: 3000 })),
    encode: vi.fn(async () => new Blob(
      [new Uint8Array(sizes[Math.min(index++, sizes.length - 1)])],
      { type: 'image/jpeg' },
    )),
  }
}

describe('fitCheckInPhotoDimensions', () => {
  it('preserves aspect ratio while bounding the long edge', () => {
    expect(fitCheckInPhotoDimensions(4000, 3000)).toEqual({ width: 2000, height: 1500 })
    expect(fitCheckInPhotoDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('prepareCheckInPhoto', () => {
  it('always decodes and re-encodes even an already small JPEG', async () => {
    const adapter: CheckInImagePreparationAdapter = {
      decode: vi.fn(async () => ({ source: {} as CanvasImageSource, width: 800, height: 600 })),
      encode: vi.fn(async () => new Blob(['prepared'], { type: 'image/jpeg' })),
    }
    const source = new File(['source'], 'front.jpg', { type: 'image/jpeg' })

    const prepared = await prepareCheckInPhoto(source, adapter)

    expect(adapter.decode).toHaveBeenCalledWith(source)
    expect(adapter.encode).toHaveBeenCalledWith(expect.anything(), 800, 600, 0.86)
    expect(prepared).not.toBe(source)
    expect(prepared.name).toBe('front.jpg')
    expect(prepared.type).toBe('image/jpeg')
  })

  it('reduces quality until the JPEG fits the bucket limit', async () => {
    const adapter = adapterWithSizes(MAX_PREPARED_CHECK_IN_PHOTO_BYTES + 1, 4_000_000)
    const source = new File(['source'], 'side.png', { type: 'image/png' })

    const prepared = await prepareCheckInPhoto(source, adapter)

    expect(prepared.size).toBe(4_000_000)
    expect(prepared.type).toBe('image/jpeg')
    expect(adapter.encode).toHaveBeenNthCalledWith(1, expect.anything(), 2000, 1500, 0.86)
    expect(adapter.encode).toHaveBeenNthCalledWith(2, expect.anything(), 2000, 1500, 0.76)
  })

  it('rejects unsupported inputs before decoding', async () => {
    const adapter = adapterWithSizes(1)
    const source = new File(['source'], 'photo.heic', { type: 'image/heic' })

    await expect(prepareCheckInPhoto(source, adapter)).rejects.toThrow('JPG, PNG alebo WebP')
    expect(adapter.decode).not.toHaveBeenCalled()
  })

  it('closes the decoded image when encoding fails', async () => {
    const close = vi.fn()
    const adapter: CheckInImagePreparationAdapter = {
      decode: vi.fn(async () => ({ source: {} as CanvasImageSource, width: 800, height: 600, close })),
      encode: vi.fn(async () => { throw new Error('encode failed') }),
    }

    await expect(prepareCheckInPhoto(
      new File(['source'], 'photo.webp', { type: 'image/webp' }),
      adapter,
    )).rejects.toThrow('encode failed')
    expect(close).toHaveBeenCalledOnce()
  })
})
