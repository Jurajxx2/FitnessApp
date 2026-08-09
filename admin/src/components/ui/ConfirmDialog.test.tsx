import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('raises the Confirm and Cancel buttons to the 44px touch floor', () => {
    render(
      <ConfirmDialog
        open
        title="Delete this?"
        description="This cannot be undone."
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-11')
  })

  it('threads locale="sk" through to the Modal close button', () => {
    render(
      <ConfirmDialog
        open
        title="Vymazať?"
        description="Túto akciu nemožno vrátiť späť."
        confirmLabel="Vymazať"
        cancelLabel="Zrušiť"
        onConfirm={() => {}}
        onClose={() => {}}
        locale="sk"
      />,
    )

    expect(screen.getByRole('button', { name: 'Zavrieť dialóg' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vymazať' })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'Zrušiť' })).toHaveClass('min-h-11')
  })
})
