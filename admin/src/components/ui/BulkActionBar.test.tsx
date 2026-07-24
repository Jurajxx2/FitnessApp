import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkActionBar } from './BulkActionBar'

describe('BulkActionBar', () => {
  it('renders nothing when nothing is selected', () => {
    const { container } = render(<BulkActionBar selectedCount={0} actions={[]} onClear={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the count and fires an action', async () => {
    const onClick = vi.fn()
    render(<BulkActionBar selectedCount={3} actions={[{ key: 'del', label: 'Delete', variant: 'danger', onClick }]} onClear={() => {}} />)
    expect(screen.getByText('3 selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('fires onClear', async () => {
    const onClear = vi.fn()
    render(<BulkActionBar selectedCount={2} actions={[]} onClear={onClear} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
