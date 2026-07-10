import { render, screen } from '@testing-library/react'
import { MacroRing } from './MacroRing'

test('MacroRing shows value, target and label', () => {
  render(<MacroRing label="Calories" value={1200} target={2000} unit="" />)
  expect(screen.getByText('1200')).toBeInTheDocument()
  expect(screen.getByText('/ 2000')).toBeInTheDocument()
  expect(screen.getByText('Calories')).toBeInTheDocument()
})
