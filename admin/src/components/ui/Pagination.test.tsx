import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from './Pagination'

const base = { page: 0, pageSize: 25, totalItems: 130, onPageChange: () => {}, onPageSizeChange: () => {} }

describe('Pagination', () => {
  it('shows the current 1-based item range and total', () => {
    render(<Pagination {...base} />)
    expect(screen.getByText('1–25 of 130')).toBeInTheDocument()
  })

  it('disables Previous on the first page and enables Next', () => {
    render(<Pagination {...base} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  })

  it('disables Next on the last page', () => {
    render(<Pagination {...base} page={5} />) // ceil(130/25)=6 pages, last index 5
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('emits the next page index', async () => {
    const onPageChange = vi.fn()
    render(<Pagination {...base} onPageChange={onPageChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('emits the selected page size', async () => {
    const onPageSizeChange = vi.fn()
    render(<Pagination {...base} onPageSizeChange={onPageSizeChange} />)
    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '50')
    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })

  it('shows 0 of 0 when empty', () => {
    render(<Pagination {...base} totalItems={0} />)
    expect(screen.getByText('0–0 of 0')).toBeInTheDocument()
  })
})
