import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionMenu } from './ActionMenu'

describe('ActionMenu', () => {
  it('opens on trigger click and renders items as menuitems', async () => {
    render(<ActionMenu label="Row actions" items={[{ key: 'open', label: 'Open', onSelect: () => {} }]} />)
    expect(screen.queryByRole('menu')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Row actions' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeInTheDocument()
  })

  it('invokes onSelect and closes when an item is clicked', async () => {
    const onSelect = vi.fn()
    render(<ActionMenu items={[{ key: 'del', label: 'Delete', onSelect, variant: 'danger' }]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Escape', async () => {
    render(<ActionMenu items={[{ key: 'open', label: 'Open', onSelect: () => {} }]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('renders nothing when items is empty', () => {
    const { container } = render(<ActionMenu items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('marks aria-expanded and aria-haspopup on the trigger', async () => {
    render(<ActionMenu items={[{ key: 'open', label: 'Open', onSelect: () => {} }]} />)
    const trigger = screen.getByRole('button', { name: 'Actions' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })
})
