import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NutritionPreferencesForm } from './NutritionPreferencesForm'
import { defaultPreferences } from '../nutrition/preferences'

describe('NutritionPreferencesForm', () => {
  it('renders the default three-meal structure and toggles an allergen', () => {
    const onChange = vi.fn()
    render(<NutritionPreferencesForm value={defaultPreferences('u1')} onChange={onChange} locale="en" />)
    expect(screen.getByLabelText('Daily meal structure')).toHaveValue('3')
    fireEvent.click(screen.getByRole('button', { name: 'Nuts' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ excluded_allergens: ['nuts'] }))
  })

  it('maps the one-snack structure to the persisted generator fields without a duplicate checkbox', () => {
    const onChange = vi.fn()
    render(<NutritionPreferencesForm value={defaultPreferences('u1')} onChange={onChange} locale="en" />)

    fireEvent.change(screen.getByLabelText('Daily meal structure'), { target: { value: '4' } })

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ meals_per_day: 4, include_snack: true }))
    expect(screen.queryByRole('checkbox', { name: 'Include snack' })).not.toBeInTheDocument()
  })

  it('uses Slovak labels when locale=sk', () => {
    render(<NutritionPreferencesForm value={defaultPreferences('u1')} onChange={() => {}} locale="sk" />)
    expect(screen.getByRole('button', { name: 'Orechy' })).toBeInTheDocument()
  })
})
