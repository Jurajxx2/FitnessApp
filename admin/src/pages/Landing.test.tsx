import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PublicLocaleProvider } from '../i18n/PublicLocale'
import Landing, { copy } from './Landing'

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }))

vi.mock('../hooks/useAuth', () => ({
  useAuth: mockUseAuth,
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
  mockUseAuth.mockReturnValue({ session: null, isAdmin: false, isLoading: false, profile: null })
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

test('switches the public landing page to Slovak and persists the choice', async () => {
  renderLanding()

  await userEvent.click(screen.getByRole('button', { name: 'sk' }))

  expect(screen.getByRole('heading', { name: 'Tvoj tréning. Tvoja strava. Tvoja trénerka.' })).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('sk')
  expect(window.localStorage.getItem('coach-foska-public-locale')).toBe('sk')
})

test('an activity-only athlete session links straight to the activity home, not /nutrition', () => {
  mockUseAuth.mockReturnValue({
    session: { user: { id: 'user-1' } },
    isAdmin: false,
    isLoading: false,
    profile: { access_mode: 'activity' },
  })
  renderLanding()

  const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(navigation).getByRole('link', { name: 'Open app' })).toHaveAttribute('href', '/activity')
})

test('sk and cs copy expose the same key set, including nested list lengths', () => {
  expect(Object.keys(copy.sk).sort()).toEqual(Object.keys(copy.cs).sort())
  expect(copy.sk.nav).toHaveLength(copy.cs.nav.length)
  expect(copy.sk.features).toHaveLength(copy.cs.features.length)
  expect(copy.sk.steps).toHaveLength(copy.cs.steps.length)
})
