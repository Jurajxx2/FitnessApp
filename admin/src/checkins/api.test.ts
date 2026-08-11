import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckInRow } from '../types/database'
import {
  emptyCheckInDraft,
  submitCheckIn,
  type CheckInSubmissionDependencies,
} from './api'

const storage = vi.hoisted(() => ({ from: vi.fn(), remove: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: storage.from } } }))

const preparedFront = new File(['front-jpeg'], 'front.jpg', { type: 'image/jpeg' })
const preparedSide = new File(['side-jpeg'], 'side.jpg', { type: 'image/jpeg' })

function dependencies() {
  const saved = { id: 'check-in-1' } as CheckInRow
  return {
    preparePhoto: vi.fn<CheckInSubmissionDependencies['preparePhoto']>(
      async (file: File) => file.name.startsWith('front') ? preparedFront : preparedSide,
    ),
    uploadPhoto: vi.fn<CheckInSubmissionDependencies['uploadPhoto']>(async (weekOf, slot) =>
      `user-1/checkin_${weekOf}_${slot}.jpg`),
    removePhotos: vi.fn<CheckInSubmissionDependencies['removePhotos']>(async () => undefined),
    save: vi.fn<CheckInSubmissionDependencies['save']>(async () => saved),
  } satisfies CheckInSubmissionDependencies
}

describe('submitCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.from.mockReturnValue({ remove: storage.remove })
    storage.remove.mockResolvedValue({ error: null })
  })

  it('prepares every selection before uploading and saves deterministic paths', async () => {
    const deps = dependencies()
    const order: string[] = []
    deps.preparePhoto.mockImplementation(async file => {
      order.push(`prepare:${file.name}`)
      return file.name.startsWith('front') ? preparedFront : preparedSide
    })
    deps.uploadPhoto.mockImplementation(async (weekOf, slot) => {
      order.push(`upload:${slot}`)
      return `user-1/checkin_${weekOf}_${slot}.jpg`
    })
    deps.save.mockImplementation(async (_userId, _weekOf, draft) => {
      order.push('save')
      return { id: 'check-in-1', ...draft } as unknown as CheckInRow
    })
    const front = new File(['front'], 'front.png', { type: 'image/png' })
    const side = new File(['side'], 'side.webp', { type: 'image/webp' })

    await submitCheckIn('user-1', '2026-08-10', emptyCheckInDraft(), null, { front, side }, deps)

    expect(order).toEqual([
      'prepare:front.png',
      'prepare:side.webp',
      'upload:front',
      'upload:side',
      'save',
    ])
    expect(deps.save).toHaveBeenCalledWith(
      'user-1',
      '2026-08-10',
      expect.objectContaining({
        photoFrontPath: 'user-1/checkin_2026-08-10_front.jpg',
        photoSidePath: 'user-1/checkin_2026-08-10_side.jpg',
      }),
      null,
    )
    expect(deps.removePhotos).not.toHaveBeenCalled()
    expect(deps.uploadPhoto).toHaveBeenNthCalledWith(1, '2026-08-10', 'front', preparedFront)
    expect(deps.uploadPhoto).toHaveBeenNthCalledWith(2, '2026-08-10', 'side', preparedSide)
  })

  it('uploads nothing when either selected image cannot be prepared', async () => {
    const deps = dependencies()
    deps.preparePhoto
      .mockResolvedValueOnce(preparedFront)
      .mockRejectedValueOnce(new Error('invalid side'))

    await expect(submitCheckIn(
      'user-1',
      '2026-08-10',
      emptyCheckInDraft(),
      null,
      {
        front: new File(['front'], 'front.png', { type: 'image/png' }),
        side: new File(['side'], 'side.png', { type: 'image/png' }),
      },
      deps,
    )).rejects.toThrow('invalid side')

    expect(deps.uploadPhoto).not.toHaveBeenCalled()
    expect(deps.save).not.toHaveBeenCalled()
    expect(deps.removePhotos).not.toHaveBeenCalled()
  })

  it('removes a newly created first object when the second upload fails', async () => {
    const deps = dependencies()
    deps.uploadPhoto
      .mockResolvedValueOnce('user-1/checkin_2026-08-10_front.jpg')
      .mockRejectedValueOnce(new Error('side upload failed'))

    await expect(submitCheckIn(
      'user-1',
      '2026-08-10',
      emptyCheckInDraft(),
      null,
      {
        front: new File(['front'], 'front.png', { type: 'image/png' }),
        side: new File(['side'], 'side.png', { type: 'image/png' }),
      },
      deps,
    )).rejects.toThrow('side upload failed')

    expect(deps.removePhotos).toHaveBeenCalledWith(['user-1/checkin_2026-08-10_front.jpg'])
    expect(deps.save).not.toHaveBeenCalled()
  })

  it('cleans a new upload when saving fails', async () => {
    const deps = dependencies()
    deps.save.mockRejectedValue(new Error('check-in save failed'))

    await expect(submitCheckIn(
      'user-1',
      '2026-08-10',
      emptyCheckInDraft(),
      null,
      { front: new File(['front'], 'front.png', { type: 'image/png' }) },
      deps,
    )).rejects.toThrow('check-in save failed')

    expect(deps.removePhotos).toHaveBeenCalledWith(['user-1/checkin_2026-08-10_front.jpg'])
  })

  it('does not delete a pre-existing referenced object when replacement save fails', async () => {
    const deps = dependencies()
    deps.save.mockRejectedValue(new Error('check-in save failed'))
    const draft = emptyCheckInDraft()
    draft.photoFrontPath = 'user-1/checkin_2026-08-10_front.jpg'

    await expect(submitCheckIn(
      'user-1',
      '2026-08-10',
      draft,
      null,
      { front: new File(['replacement'], 'front.png', { type: 'image/png' }) },
      deps,
    )).rejects.toThrow('check-in save failed')

    expect(deps.removePhotos).not.toHaveBeenCalled()
  })
})
