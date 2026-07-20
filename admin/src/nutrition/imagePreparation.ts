import { MAX_MEAL_PHOTO_BYTES, MEAL_PHOTO_TYPES } from '../lib/storage'

export const MAX_PREPARED_MEAL_PHOTO_BYTES = 1_500_000
export const MAX_PREPARED_MEAL_PHOTO_DIMENSION = 1600

export type DecodedMealImage = {
  source: CanvasImageSource
  width: number
  height: number
  close?: () => void
}

export type ImagePreparationAdapter = {
  decode: (file: File) => Promise<DecodedMealImage>
  encode: (image: DecodedMealImage, width: number, height: number, quality: number) => Promise<Blob>
}

export function fitMealPhotoDimensions(width: number, height: number, maxDimension = MAX_PREPARED_MEAL_PHOTO_DIMENSION) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Fotografiu sa nepodarilo načítať.')
  }
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

async function defaultDecode(file: File): Promise<DecodedMealImage> {
  if ('createImageBitmap' in globalThis) {
    const bitmap = await createImageBitmap(file)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Fotografiu sa nepodarilo načítať.'))
    }
    image.src = url
  })
}

async function defaultEncode(image: DecodedMealImage, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Fotografiu sa nepodarilo pripraviť.')
  context.drawImage(image.source, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Fotografiu sa nepodarilo pripraviť.')),
      'image/jpeg',
      quality,
    )
  })
}

const browserAdapter: ImagePreparationAdapter = { decode: defaultDecode, encode: defaultEncode }

/**
 * Bounds the selected photo before either AI analysis or a confirmed upload.
 * Callers should keep and reuse this returned file for both operations.
 */
export async function prepareMealPhoto(file: File, adapter: ImagePreparationAdapter = browserAdapter): Promise<File> {
  if (!MEAL_PHOTO_TYPES.includes(file.type as typeof MEAL_PHOTO_TYPES[number]) || file.size <= 0) {
    throw new Error('Vyber fotografiu vo formáte JPG, PNG alebo WebP.')
  }
  if (file.size > MAX_MEAL_PHOTO_BYTES) {
    throw new Error('Fotografia môže mať najviac 10 MB.')
  }

  let image: DecodedMealImage | null = null
  try {
    image = await adapter.decode(file)
    let dimensions = fitMealPhotoDimensions(image.width, image.height)
    if (
      file.size <= MAX_PREPARED_MEAL_PHOTO_BYTES
      && dimensions.width === image.width
      && dimensions.height === image.height
    ) return file

    for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
      for (const quality of [0.84, 0.74, 0.64, 0.54]) {
        const blob = await adapter.encode(image, dimensions.width, dimensions.height, quality)
        if (blob.size <= MAX_PREPARED_MEAL_PHOTO_BYTES) {
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'meal'
          return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
        }
      }
      dimensions = {
        width: Math.max(1, Math.round(dimensions.width * 0.78)),
        height: Math.max(1, Math.round(dimensions.height * 0.78)),
      }
    }
    throw new Error('Fotografiu sa nepodarilo zmenšiť pod povolený limit.')
  } finally {
    image?.close?.()
  }
}
