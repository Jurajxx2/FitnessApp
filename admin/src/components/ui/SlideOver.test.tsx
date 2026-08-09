import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlideOver } from './SlideOver'

describe('SlideOver', () => {
  it('defaults the close-button aria-label to English', () => {
    render(<SlideOver open onClose={() => {}} title="Browse exercises">content</SlideOver>)

    expect(screen.getByRole('button', { name: 'Close panel' })).toBeInTheDocument()
  })

  it('uses the Slovak close-panel label when locale="sk"', () => {
    render(<SlideOver open onClose={() => {}} title="Prehľad cvikov" locale="sk">content</SlideOver>)

    expect(screen.getByRole('button', { name: 'Zavrieť panel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close panel' })).not.toBeInTheDocument()
  })

  it('calls onClose when the close button is activated', () => {
    const onClose = vi.fn()
    render(<SlideOver open onClose={onClose} title="Browse exercises">content</SlideOver>)

    screen.getByRole('button', { name: 'Close panel' }).click()
    expect(onClose).toHaveBeenCalled()
  })
})
