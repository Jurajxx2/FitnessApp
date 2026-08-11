export const CHECK_IN_SOURCE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_CHECK_IN_SOURCE_BYTES = 25 * 1024 * 1024
export const MAX_PREPARED_CHECK_IN_PHOTO_BYTES = 5 * 1024 * 1024
export const MAX_CHECK_IN_PHOTO_DIMENSION = 2000

export type DecodedCheckInImage = {
  source: CanvasImageSource
  width: number
  height: number
  close?: () => void
}

export type CheckInImagePreparationAdapter = {
  decode: (file: File) => Promise<DecodedCheckInImage>
  encode: (image: DecodedCheckInImage, width: number, height: number, quality: number) => Promise<Blob>
}

export function fitCheckInPhotoDimensions(
  width: number,
  height: number,
  maxDimension = MAX_CHECK_IN_PHOTO_DIMENSION,
) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Fotografiu sa nepodarilo načítať.')
  }
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function defaultDecode(file: File): Promise<DecodedCheckInImage> {
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

async function defaultEncode(
  image: DecodedCheckInImage,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
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

const browserAdapter: CheckInImagePreparationAdapter = { decode: defaultDecode, encode: defaultEncode }

/** Decodes every accepted source and emits a bounded JPEG for Storage. */
export async function prepareCheckInPhoto(
  file: File,
  adapter: CheckInImagePreparationAdapter = browserAdapter,
): Promise<File> {
  if (!CHECK_IN_SOURCE_TYPES.includes(file.type as typeof CHECK_IN_SOURCE_TYPES[number]) || file.size <= 0) {
    throw new Error('Vyber fotografiu vo formáte JPG, PNG alebo WebP.')
  }
  if (file.size > MAX_CHECK_IN_SOURCE_BYTES) {
    throw new Error('Pôvodná fotografia môže mať najviac 25 MB.')
  }

  let image: DecodedCheckInImage | null = null
  try {
    image = await adapter.decode(file)
    let dimensions = fitCheckInPhotoDimensions(image.width, image.height)

    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      for (const quality of [0.86, 0.76, 0.66, 0.56]) {
        const blob = await adapter.encode(image, dimensions.width, dimensions.height, quality)
        if (blob.type !== 'image/jpeg') {
          throw new Error('Fotografiu sa nepodarilo previesť do formátu JPEG.')
        }
        if (blob.size <= MAX_PREPARED_CHECK_IN_PHOTO_BYTES) {
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'checkin'
          return new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          })
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
