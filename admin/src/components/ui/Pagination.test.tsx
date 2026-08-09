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

  it('defaults to English copy when locale is omitted', () => {
    render(<Pagination {...base} />)
    expect(screen.getByLabelText('Rows per page')).toBeInTheDocument()
    expect(screen.getByText('Previous')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('renders Slovak copy when locale="sk"', () => {
    render(<Pagination {...base} locale="sk" />)
    expect(screen.getByLabelText('Riadkov na stranu')).toBeInTheDocument()
    expect(screen.getByText('Predchádzajúca')).toBeInTheDocument()
    expect(screen.getByText('Ďalšia')).toBeInTheDocument()
    expect(screen.getByText('1–25 z 130')).toBeInTheDocument()
  })

  it('exposes Slovak accessible names for Previous/Next under locale="sk"', () => {
    render(<Pagination {...base} locale="sk" />)
    expect(screen.getByRole('button', { name: 'Predchádzajúca strana' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ďalšia strana' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Previous page' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
  })

  it('raises the Previous/Next buttons and the rows-per-page select to the 44px touch floor', () => {
    render(<Pagination {...base} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveClass('min-h-11')
    expect(screen.getByLabelText('Rows per page')).toHaveClass('min-h-11')
  })

  it('hides the rows-per-page label and select when there is only one page-size option', () => {
    render(<Pagination {...base} pageSizeOptions={[25]} />)
    expect(screen.queryByLabelText('Rows per page')).not.toBeInTheDocument()
    expect(screen.queryByText('Rows per page')).not.toBeInTheDocument()
  })

  it('keeps the count and Previous/Next controls rendering when the selector is hidden', () => {
    render(<Pagination {...base} pageSizeOptions={[25]} />)
    expect(screen.getByText('1–25 of 130')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument()
  })
})
