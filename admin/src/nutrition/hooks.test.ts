import { renderHook } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFoodSearch, useMealHistory, useRecipes } from './hooks'

const { KEEP_PREVIOUS_DATA } = vi.hoisted(() => ({ KEEP_PREVIOUS_DATA: Symbol('keepPreviousData') }))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  keepPreviousData: KEEP_PREVIOUS_DATA,
}))
vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'athlete-1' } }),
}))

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

describe('useRecipes', () => {
  it('passes placeholderData: keepPreviousData so a new search/page key keeps serving the previous page instead of flipping isLoading true', () => {
    renderHook(() => useRecipes(0, 24, 'ryza', null))

    expect(vi.mocked(useQuery).mock.calls[0][0]).toMatchObject({ placeholderData: KEEP_PREVIOUS_DATA })
  })
})

describe('useMealHistory', () => {
  it('passes placeholderData: keepPreviousData so paging keeps serving the previous page instead of flipping isLoading true', () => {
    renderHook(() => useMealHistory(0, 24))

    expect(vi.mocked(useQuery).mock.calls[0][0]).toMatchObject({ placeholderData: KEEP_PREVIOUS_DATA })
  })
})
