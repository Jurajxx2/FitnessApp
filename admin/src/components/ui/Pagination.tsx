import { useId } from 'react'
import { Button } from './Button'

interface PaginationProps {
  page: number
  pageSize: number
  totalItems: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const selectId = useId()
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = totalItems === 0 ? 0 : page * pageSize + 1
  const end = Math.min(totalItems, (page + 1) * pageSize)

  return (
    <div className="flex flex-col gap-3 border-t border-outline bg-surface-elevated px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <label htmlFor={selectId}>Rows per page</label>
        <select
          id={selectId}
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-lg border border-outline bg-surface px-2 py-1 text-text-primary outline-none focus:border-accent-strong"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <span aria-live="polite">{start}–{end} of {totalItems}</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            className="min-h-9 px-3"
            aria-label="Previous page"
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
          >
            <span aria-hidden="true" className="text-base leading-none">←</span>
            <span>Previous</span>
          </Button>
          <Button
            variant="ghost"
            className="min-h-9 px-3"
            aria-label="Next page"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
          >
            <span>Next</span>
            <span aria-hidden="true" className="text-base leading-none">→</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
