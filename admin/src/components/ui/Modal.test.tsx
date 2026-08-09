import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal', () => {
  it('defaults the close-button aria-label to English and gives it a 44px tap target', () => {
    render(<Modal open onClose={() => {}} title="Details">content</Modal>)

    const closeButton = screen.getByRole('button', { name: 'Close dialog' })
    expect(closeButton).toHaveClass('min-h-11', 'min-w-11')
  })

  it('uses the Slovak close-dialog label when locale="sk"', () => {
    render(<Modal open onClose={() => {}} title="Detaily" locale="sk">content</Modal>)

    expect(screen.getByRole('button', { name: 'Zavrieť dialóg' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument()
  })

  it('calls onClose when the close button is activated', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="Details">content</Modal>)

    screen.getByRole('button', { name: 'Close dialog' }).click()
    expect(onClose).toHaveBeenCalled()
  })
})
