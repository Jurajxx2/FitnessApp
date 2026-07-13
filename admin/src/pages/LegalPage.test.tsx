import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LegalPage from './LegalPage'

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})
test('keeps the privacy notice visibly pre-release while operator details are missing', () => {
  render(
    <MemoryRouter>
      <LegalPage kind="privacy" />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Privacy notice' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Pre-release legal draft' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '3. Purposes and legal bases' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'European Commission: information for individuals' })).toHaveAttribute('href', expect.stringContaining('commission.europa.eu'))
})

test('states that purchases are not offered in the current terms', () => {
  render(
    <MemoryRouter>
      <LegalPage kind="terms" />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Terms of use' })).toBeInTheDocument()
  expect(screen.getByText(/does not currently offer a purchase/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Your Europe: contract information' })).toHaveAttribute('href', expect.stringContaining('europa.eu'))
})
