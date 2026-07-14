import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NutritionPreferencesForm } from './NutritionPreferencesForm'
import { defaultPreferences } from '../nutrition/preferences'

describe('NutritionPreferencesForm', () => {
  it('renders defaults and toggles an allergen', () => {
    const onChange = vi.fn()
    render(<NutritionPreferencesForm value={defaultPreferences('u1')} onChange={onChange} locale="en" />)
    // default: 3 meals, no snack, no exclusions
    expect(screen.getByLabelText('Include snack')).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Nuts' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ excluded_allergens: ['nuts'] }))
  })

  it('uses Slovak labels when locale=sk', () => {
    render(<NutritionPreferencesForm value={defaultPreferences('u1')} onChange={() => {}} locale="sk" />)
    expect(screen.getByRole('button', { name: 'Orechy' })).toBeInTheDocument()
  })
})
