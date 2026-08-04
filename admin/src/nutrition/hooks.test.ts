import { renderHook } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFoodSearch } from './hooks'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: {} }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: false, isError: false } as unknown as ReturnType<typeof useQuery>)
})

describe('useFoodSearch', () => {
  it('disables the query below 2 characters', () => {
    renderHook(() => useFoodSearch('r'))

    expect(vi.mocked(useQuery).mock.calls[0][0]).toMatchObject({ enabled: false })
  })

  it('disables the query for a blank/whitespace-only value', () => {
    renderHook(() => useFoodSearch('  '))

    expect(vi.mocked(useQuery).mock.calls[0][0]).toMatchObject({ enabled: false })
  })

  it('enables the query at 2 characters', () => {
    renderHook(() => useFoodSearch('ry'))

    expect(vi.mocked(useQuery).mock.calls[0][0]).toMatchObject({ enabled: true })
  })

  it('enables the query beyond 2 characters', () => {
    renderHook(() => useFoodSearch('ryza'))

    expect(vi.mocked(useQuery).mock.calls[0][0]).toMatchObject({ enabled: true })
  })
})
