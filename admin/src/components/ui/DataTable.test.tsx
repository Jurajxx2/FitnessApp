import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable, DataColumn } from './DataTable'

interface Row { id: string; name: string }
const rows: Row[] = Array.from({ length: 7 }, (_, i) => ({ id: String(i + 1), name: `Item ${i + 1}` }))
const columns: DataColumn<Row>[] = [{ key: 'name', header: 'Name', render: (r) => r.name }]

function setup(extra = {}) {
  return render(
    <DataTable<Row>
      rows={rows}
      getRowId={(r) => r.id}
      columns={columns}
      rowLabel={(r) => `Open ${r.name}`}
      {...extra}
    />,
  )
}

describe('DataTable', () => {
  it('paginates client-side using the page size', async () => {
    setup({ pageSize: 5 })
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.queryByText('Item 6')).toBeNull()
    expect(screen.getByText('1–5 of 7')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Item 6')).toBeInTheDocument()
    expect(screen.getByText('6–7 of 7')).toBeInTheDocument()
  })

  it('activates a row on click', async () => {
    const onRowActivate = vi.fn()
    setup({ pageSize: 25, onRowActivate })
    await userEvent.click(screen.getByText('Item 3'))
    expect(onRowActivate).toHaveBeenCalledWith(rows[2])
  })

  it('renders a row overflow menu and fires its action', async () => {
    const onSelect = vi.fn()
    setup({ pageSize: 25, rowActions: (r: Row) => [{ key: 'open', label: `Open ${r.name}`, onSelect: () => onSelect(r.id) }] })
    const menuTriggers = screen.getAllByRole('button', { name: 'Actions' })
    await userEvent.click(menuTriggers[0])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open Item 1' }))
    expect(onSelect).toHaveBeenCalledWith('1')
  })

  it('supports select-all and per-row selection with a bulk action', async () => {
    const bulk = vi.fn()
    setup({
      pageSize: 25,
      selectable: true,
      bulkActions: (selected: Row[]) => [{ key: 'del', label: 'Delete', variant: 'danger', onClick: () => bulk(selected.map((r) => r.id)) }],
    })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(screen.getByText('7 selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(bulk).toHaveBeenCalledWith(['1', '2', '3', '4', '5', '6', '7'])
  })

  it('select-all spans every page of the filtered set, including off-screen rows', async () => {
    const bulk = vi.fn()
    setup({
      pageSize: 5,
      selectable: true,
      bulkActions: (selected: Row[]) => [{ key: 'del', label: 'Delete', variant: 'danger', onClick: () => bulk(selected.map((r) => r.id)) }],
    })
    // Page 2 rows are not rendered, so select-all must reach beyond the visible page.
    expect(screen.getByText('Item 5')).toBeInTheDocument()
    expect(screen.queryByText('Item 6')).toBeNull()
    expect(screen.queryByText('Item 7')).toBeNull()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(screen.getByText('7 selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(bulk).toHaveBeenCalledWith(['1', '2', '3', '4', '5', '6', '7'])
  })

  it('shows the empty node when there are no rows', () => {
    render(
      <DataTable<Row> rows={[]} getRowId={(r) => r.id} columns={columns} empty={<div>Nothing here</div>} />,
    )
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('uses external pagination props in server mode', async () => {
    const onPageChange = vi.fn()
    render(
      <DataTable<Row>
        rows={rows.slice(0, 5)}
        getRowId={(r) => r.id}
        columns={columns}
        serverPagination
        page={0}
        pageSize={5}
        totalItems={12}
        onPageChange={onPageChange}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText('1–5 of 12')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })
})
