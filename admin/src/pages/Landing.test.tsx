import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PublicLocaleProvider } from '../i18n/PublicLocale'
import Landing from './Landing'

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ session: null, isAdmin: false, isLoading: false, profile: null }),
}))

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  window.localStorage.clear()
})

function renderLanding() {
  return render(
    <PublicLocaleProvider>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </PublicLocaleProvider>,
  )
}

test('shows one sign-in action in the header and honest mobile release status', () => {
  renderLanding()

  const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(navigation).getAllByRole('link', { name: 'Sign in' })).toHaveLength(1)
  expect(screen.getByRole('heading', { name: 'iOS and Android versions are in preparation.' })).toBeInTheDocument()
  expect(screen.getAllByText('Preparing release')).toHaveLength(2)
  expect(screen.queryByText(/bank-grade/i)).not.toBeInTheDocument()
})

test('switches the public landing page to Czech and persists the choice', async () => {
  renderLanding()

  await userEvent.click(screen.getByRole('button', { name: 'cs' }))

  expect(screen.getByRole('heading', { name: 'Váš trénink. Vaše strava. Váš trenér.' })).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('cs')
  expect(window.localStorage.getItem('coach-foska-public-locale')).toBe('cs')
})
