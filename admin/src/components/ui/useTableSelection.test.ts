import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableSelection } from './useTableSelection'

describe('useTableSelection', () => {
  it('toggles a single id', () => {
    const { result } = renderHook(() => useTableSelection(['a', 'b', 'c']))
    act(() => result.current.toggle('b'))
    expect(result.current.isSelected('b')).toBe(true)
    expect(result.current.selectedIds).toEqual(['b'])
    expect(result.current.someSelected).toBe(true)
    expect(result.current.allSelected).toBe(false)
  })

  it('toggleAll selects then clears everything', () => {
    const { result } = renderHook(() => useTableSelection(['a', 'b']))
    act(() => result.current.toggleAll())
    expect(result.current.allSelected).toBe(true)
    expect(result.current.selectedIds).toEqual(['a', 'b'])
    act(() => result.current.toggleAll())
    expect(result.current.selectedCount).toBe(0)
  })

  it('prunes ids that disappear from allIds', () => {
    const { result, rerender } = renderHook(({ ids }) => useTableSelection(ids), {
      initialProps: { ids: ['a', 'b', 'c'] },
    })
    act(() => result.current.toggle('c'))
    expect(result.current.isSelected('c')).toBe(true)
    rerender({ ids: ['a', 'b'] }) // 'c' filtered out
    expect(result.current.isSelected('c')).toBe(false)
    expect(result.current.selectedCount).toBe(0)
  })

  it('keeps selection stable when the same ids are passed as a new array', () => {
    const { result, rerender } = renderHook(({ ids }) => useTableSelection(ids), {
      initialProps: { ids: ['a', 'b'] },
    })
    act(() => result.current.toggle('a'))
    rerender({ ids: ['a', 'b'] }) // new array, same contents
    expect(result.current.isSelected('a')).toBe(true)
  })
})
