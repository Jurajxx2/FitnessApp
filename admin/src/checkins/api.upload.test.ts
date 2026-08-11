import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke },
  },
}))

import { uploadCheckInPhoto } from './api'

function file(size: number, type: string): File {
  return { size, type } as File
}

describe('uploadCheckInPhoto', () => {
  beforeEach(() => invoke.mockReset())

  it('rejects unsupported or oversized files before the network call', async () => {
    await expect(uploadCheckInPhoto('2026-08-10', 'front', file(9 * 1024 * 1024, 'image/jpeg')))
      .rejects.toThrow('8 MB')
    await expect(uploadCheckInPhoto('2026-08-10', 'front', file(100, 'image/gif')))
      .rejects.toThrow('JPEG or PNG')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('uses the authenticated validator contract and trusts only its returned path', async () => {
    const photo = file(1_024, 'image/png')
    invoke.mockResolvedValue({
      data: { path: 'user-id/checkin_2026-08-10_side.png' },
      error: null,
    })

    await expect(uploadCheckInPhoto('2026-08-10', 'side', photo))
      .resolves.toBe('user-id/checkin_2026-08-10_side.png')
    expect(invoke).toHaveBeenCalledWith('check-in-photo-upload', {
      body: photo,
      headers: {
        'x-check-in-week': '2026-08-10',
        'x-check-in-slot': 'side',
      },
    })
  })
})
