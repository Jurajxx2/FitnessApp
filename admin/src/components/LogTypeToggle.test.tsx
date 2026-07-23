import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LogTypeToggle } from './LogTypeToggle'

describe('LogTypeToggle', () => {
  it('renders the three options with English labels and marks the active one pressed', () => {
    render(<LogTypeToggle value="bodyweight_reps" onChange={vi.fn()} locale="en" />)

    expect(screen.getByRole('button', { name: 'Weight + Reps' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Bodyweight' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Time' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders Slovak labels for locale=sk', () => {
    render(<LogTypeToggle value="time" onChange={vi.fn()} locale="sk" />)

    expect(screen.getByRole('button', { name: 'Váha + opak.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vlastná váha' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Čas' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('fires onChange with the clicked option value', () => {
    const onChange = vi.fn()
    render(<LogTypeToggle value="weight_reps" onChange={onChange} locale="en" />)

    fireEvent.click(screen.getByRole('button', { name: 'Time' }))

    expect(onChange).toHaveBeenCalledWith('time')
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('does not fire onChange when clicking the already-active option', () => {
    const onChange = vi.fn()
    render(<LogTypeToggle value="weight_reps" onChange={onChange} locale="en" />)

    fireEvent.click(screen.getByRole('button', { name: 'Weight + Reps' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables interaction when disabled', () => {
    const onChange = vi.fn()
    render(<LogTypeToggle value="weight_reps" onChange={onChange} locale="en" disabled />)

    const button = screen.getByRole('button', { name: 'Time' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onChange).not.toHaveBeenCalled()
  })
})
