import { ReactNode, useEffect, useMemo, useState } from 'react'
import { Table, Th, Td, ClickableRow } from './Table'
import { Checkbox } from './Checkbox'
import { ActionMenu, ActionMenuItem } from './ActionMenu'
import { Pagination } from './Pagination'
import { BulkActionBar, BulkAction } from './BulkActionBar'
import { useTableSelection } from './useTableSelection'
import { Shimmer } from './Shimmer'

export interface DataColumn<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  className?: string
  headerClassName?: string
}

interface DataTableProps<T> {
  rows: T[]
  getRowId: (row: T) => string
  columns: DataColumn<T>[]
  rowLabel?: (row: T) => string
  onRowActivate?: (row: T) => void
  rowActions?: (row: T) => ActionMenuItem[]
  selectable?: boolean
  bulkActions?: (selected: T[], api: { clearSelection: () => void }) => BulkAction[]
  pageSize?: number
  pageSizeOptions?: number[]
  serverPagination?: boolean
  page?: number
  totalItems?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  loading?: boolean
  loadingRowCount?: number
  empty?: ReactNode
}

export function DataTable<T>({
  rows,
  getRowId,
  columns,
  rowLabel,
  onRowActivate,
  rowActions,
  selectable = false,
  bulkActions,
  pageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  serverPagination = false,
  page: serverPage = 0,
  totalItems: serverTotal = 0,
  onPageChange,
  onPageSizeChange,
  loading = false,
  loadingRowCount = 5,
  empty,
}: DataTableProps<T>) {
  const ids = useMemo(() => rows.map(getRowId), [rows, getRowId])
  const selection = useTableSelection(ids)

  const [clientPage, setClientPage] = useState(0)
  const [clientSize, setClientSize] = useState(pageSize)

  const totalItems = serverPagination ? serverTotal : rows.length
  const activeSize = serverPagination ? pageSize : clientSize
  const totalPages = Math.max(1, Math.ceil(totalItems / activeSize))
  const activePage = serverPagination ? serverPage : Math.min(clientPage, totalPages - 1)

  // Clamp client page when the filtered set shrinks below the current page.
  useEffect(() => {
    if (!serverPagination && clientPage > totalPages - 1) setClientPage(totalPages - 1)
  }, [serverPagination, clientPage, totalPages])

  const displayRows = serverPagination
    ? rows
    : rows.slice(activePage * activeSize, activePage * activeSize + activeSize)

  const leadingCols = selectable ? 1 : 0
  const trailingCols = rowActions ? 1 : 0
  const colSpan = columns.length + leadingCols + trailingCols

  const selectedRows = useMemo(
    () => rows.filter((row) => selection.isSelected(getRowId(row))),
    [rows, selection, getRowId],
  )

  function handlePageChange(next: number) {
    if (serverPagination) onPageChange?.(next)
    else setClientPage(next)
  }

  function handlePageSizeChange(next: number) {
    if (serverPagination) onPageSizeChange?.(next)
    else { setClientSize(next); setClientPage(0) }
  }

  if (!loading && rows.length === 0) {
    return <>{empty}</>
  }

  return (
    <div>
      {selectable && bulkActions && (
        <BulkActionBar
          selectedCount={selection.selectedCount}
          actions={bulkActions(selectedRows, { clearSelection: selection.clear })}
          onClear={selection.clear}
        />
      )}
      <div className="overflow-hidden rounded-2xl border border-outline bg-surface-elevated">
        <Table contained>
          <thead>
          <tr>
            {selectable && (
              <Th>
                <span className="sr-only">Select all</span>
                <Checkbox
                  label="Select all"
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onChange={selection.toggleAll}
                />
              </Th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`ledger-label border-b border-outline px-4 py-3 text-left text-text-secondary first:pl-4 ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
            {rowActions && (
              <Th><span className="sr-only">Actions</span></Th>
            )}
          </tr>
          </thead>
          <tbody>
          {loading
            ? Array.from({ length: loadingRowCount }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  <Td className="" >
                    <Shimmer className="h-6" />
                  </Td>
                  {Array.from({ length: colSpan - 1 }).map((__, j) => (
                    <Td key={j}><Shimmer className="h-6" /></Td>
                  ))}
                </tr>
              ))
            : displayRows.map((row) => {
                const id = getRowId(row)
                const cells = (
                  <>
                    {selectable && (
                      <Td className="w-10">
                        <Checkbox
                          label={`Select ${rowLabel ? rowLabel(row) : id}`}
                          checked={selection.isSelected(id)}
                          onChange={() => selection.toggle(id)}
                        />
                      </Td>
                    )}
                    {columns.map((col) => (
                      <Td key={col.key} className={col.className}>{col.render(row)}</Td>
                    ))}
                    {rowActions && (
                      <Td className="w-12 text-right">
                        <div className="flex justify-end">
                          <ActionMenu items={rowActions(row)} />
                        </div>
                      </Td>
                    )}
                  </>
                )
                return onRowActivate ? (
                  <ClickableRow key={id} label={rowLabel ? rowLabel(row) : id} onActivate={() => onRowActivate(row)}>
                    {cells}
                  </ClickableRow>
                ) : (
                  <tr key={id}>{cells}</tr>
                )
              })}
          </tbody>
        </Table>
        {!loading && totalItems > 0 && (
          <Pagination
            page={activePage}
            pageSize={activeSize}
            totalItems={totalItems}
            pageSizeOptions={pageSizeOptions}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    </div>
  )
}
