import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('reports the new checked value on click', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Select row" />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select row' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('reflects checked state', () => {
    render(<Checkbox checked onChange={() => {}} label="Select row" />)
    expect(screen.getByRole('checkbox', { name: 'Select row' })).toBeChecked()
  })

  it('applies indeterminate to the DOM node when not checked', () => {
    render(<Checkbox checked={false} indeterminate onChange={() => {}} label="Select all" />)
    const el = screen.getByRole('checkbox', { name: 'Select all' }) as HTMLInputElement
    expect(el.indeterminate).toBe(true)
  })
})
