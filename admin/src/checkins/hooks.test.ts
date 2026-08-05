import { renderHook } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCheckIns } from './hooks'

const { KEEP_PREVIOUS_DATA } = vi.hoisted(() => ({ KEEP_PREVIOUS_DATA: Symbol('keepPreviousData') }))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
  keepPreviousData: KEEP_PREVIOUS_DATA,
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: false, isError: false } as unknown as ReturnType<typeof useQuery>)
})

describe('useCheckIns', () => {
  it('passes placeholderData: keepPreviousData so paging keeps serving the previous page instead of flipping isLoading true', () => {
    renderHook(() => useCheckIns(0, 12))

    expect(vi.mocked(useQuery).mock.calls[0][0]).toMatchObject({ placeholderData: KEEP_PREVIOUS_DATA })
  })
})
