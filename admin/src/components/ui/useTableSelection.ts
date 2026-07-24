import { useCallback, useEffect, useMemo, useState } from 'react'

export interface TableSelection {
  selectedIds: string[]
  selectedCount: number
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleAll: () => void
  clear: () => void
  allSelected: boolean
  someSelected: boolean
}

export function useTableSelection(allIds: string[]): TableSelection {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const idsKey = allIds.join(',')

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const next = new Set<string>()
      for (const id of allIds) if (prev.has(id)) next.add(id)
      return next.size === prev.size ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)))
  }, [idsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedIds = useMemo(() => allIds.filter((id) => selected.has(id)), [idsKey, selected]) // eslint-disable-line react-hooks/exhaustive-deps
  const allSelected = allIds.length > 0 && selected.size === allIds.length
  const someSelected = selected.size > 0 && !allSelected

  return { selectedIds, selectedCount: selected.size, isSelected, toggle, toggleAll, clear, allSelected, someSelected }
}
