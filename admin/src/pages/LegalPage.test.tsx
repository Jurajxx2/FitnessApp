import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PublicLocaleProvider } from '../i18n/PublicLocale'
import LegalPage, { pageCopy, privacyDocument, termsDocument } from './LegalPage'

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

test('renders the Slovak privacy notice with the pre-release banner', () => {
  window.localStorage.setItem('coach-foska-public-locale', 'sk')
  render(
    <PublicLocaleProvider>
      <MemoryRouter>
        <LegalPage kind="privacy" />
      </MemoryRouter>
    </PublicLocaleProvider>,
  )

  expect(screen.getByRole('heading', { name: 'Informácie o spracúvaní osobných údajov' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Právny návrh pred spustením' })).toBeInTheDocument()
  window.localStorage.clear()
})

test('sk privacy resource link mirrors cs (same authority as the body text, not a different one)', () => {
  const sk = privacyDocument('sk')
  const cs = privacyDocument('cs')
  expect(sk.resourceUrl).toBe(cs.resourceUrl)
  expect(sk.sections[7].body).toContain('Českej republiky')
})

test('sk terms resource link mirrors cs', () => {
  const sk = termsDocument('sk')
  const cs = termsDocument('cs')
  expect(sk.resourceUrl).toBe(cs.resourceUrl)
})

test('sk and cs pageCopy expose the same key set', () => {
  expect(Object.keys(pageCopy.sk).sort()).toEqual(Object.keys(pageCopy.cs).sort())
})

test('sk and cs privacy documents have the same section count and top-level shape', () => {
  const sk = privacyDocument('sk')
  const cs = privacyDocument('cs')
  expect(Object.keys(sk).sort()).toEqual(Object.keys(cs).sort())
  expect(sk.sections).toHaveLength(cs.sections.length)
  expect(sk.sections.every(section => section.title.trim().length > 0 && section.body.trim().length > 0)).toBe(true)
})

test('sk and cs terms documents have the same section count and top-level shape', () => {
  const sk = termsDocument('sk')
  const cs = termsDocument('cs')
  expect(Object.keys(sk).sort()).toEqual(Object.keys(cs).sort())
  expect(sk.sections).toHaveLength(cs.sections.length)
  expect(sk.sections.every(section => section.title.trim().length > 0 && section.body.trim().length > 0)).toBe(true)
})
