import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SelectedExerciseCard } from './SelectedExerciseCard'

describe('SelectedExerciseCard', () => {
  it('exposes accessible reorder and remove controls', () => {
    const onMove = vi.fn()
    const onRemove = vi.fn()
    render(
      <SelectedExerciseCard clientId="one" name="Bench Press" index={1} total={3} locale="en" onMove={onMove} onDropExercise={vi.fn()} onRemove={onRemove}>
        <span>Fields</span>
      </SelectedExerciseCard>
    )

    fireEvent.click(screen.getByLabelText('Move Bench Press up'))
    fireEvent.click(screen.getByLabelText('Move Bench Press down'))
    fireEvent.click(screen.getByLabelText('Remove Bench Press'))

    expect(onMove).toHaveBeenNthCalledWith(1, 0)
    expect(onMove).toHaveBeenNthCalledWith(2, 2)
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('disables movement beyond the list boundaries', () => {
    render(
      <SelectedExerciseCard clientId="one" name="Squat" index={0} total={1} locale="en" onMove={vi.fn()} onDropExercise={vi.fn()} onRemove={vi.fn()}>
        <span>Fields</span>
      </SelectedExerciseCard>
    )
    expect(screen.getByLabelText('Move Squat up')).toBeDisabled()
    expect(screen.getByLabelText('Move Squat down')).toBeDisabled()
  })

  it('opens linked exercise details in a new tab so editor state is preserved', () => {
    render(
      <SelectedExerciseCard clientId="one" name="Squat" detailHref="/activity/exercises/ex-1" index={0} total={1} locale="sk" onMove={vi.fn()} onDropExercise={vi.fn()} onRemove={vi.fn()}>
        <span>Fields</span>
      </SelectedExerciseCard>
    )

    const link = screen.getByRole('link', { name: 'Otvoriť detail cviku Squat' })
    expect(link).toHaveAttribute('href', '/activity/exercises/ex-1')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
