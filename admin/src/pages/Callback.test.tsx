import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicLocaleProvider } from '../i18n/PublicLocale'
import Callback, { copy } from './Callback'

const { mockOnAuthStateChange, authState, assuranceState } = vi.hoisted(() => ({
  mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  authState: { session: null as any, profile: null as any, isLoading: false },
  assuranceState: { currentLevel: null as 'aal1' | 'aal2' | null, nextLevel: null as 'aal1' | 'aal2' | null, error: null as Error | null, isLoading: false },
}))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: mockOnAuthStateChange } },
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ ...authState }),
  useAuthAssurance: () => ({ ...assuranceState, refreshAssuranceLevel: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  authState.session = null
  authState.profile = null
  authState.isLoading = false
  assuranceState.currentLevel = null
  assuranceState.nextLevel = null
  assuranceState.error = null
  assuranceState.isLoading = false
})

function renderCallback() {
  return render(
    <PublicLocaleProvider>
      <MemoryRouter>
        <Callback />
      </MemoryRouter>
    </PublicLocaleProvider>,
  )
}

test('shows the English signing-in message when no PublicLocaleProvider is present', () => {
  render(
    <MemoryRouter>
      <Callback />
    </MemoryRouter>,
  )
  expect(screen.getByText('Signing you in…')).toBeInTheDocument()
})

test('shows the Slovak signing-in message when the stored locale is sk', () => {
  window.localStorage.setItem('coach-foska-public-locale', 'sk')
  renderCallback()
  expect(screen.getByText('Prihlasujem ťa…')).toBeInTheDocument()
  window.localStorage.clear()
})

test('sk and cs copy expose the same key set', () => {
  expect(Object.keys(copy.sk).sort()).toEqual(Object.keys(copy.cs).sort())
})

test('returns a completed callback without a session to login', () => {
  render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <Routes>
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByText('Login page')).toBeInTheDocument()
})

test('routes an aal1 admin callback to MFA', () => {
  authState.session = { user: { id: 'admin-1' } }
  authState.profile = { is_admin: true, is_blocked: false, access_mode: 'both' }
  assuranceState.currentLevel = 'aal1'
  assuranceState.nextLevel = 'aal2'
  render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <Routes>
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/admin/mfa" element={<div>MFA page</div>} />
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByText('MFA page')).toBeInTheDocument()
})

test('routes an aal2 admin callback to admin', () => {
  authState.session = { user: { id: 'admin-1' } }
  authState.profile = { is_admin: true, is_blocked: false, access_mode: 'both' }
  assuranceState.currentLevel = 'aal2'
  assuranceState.nextLevel = 'aal2'
  render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <Routes>
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/admin" element={<div>Admin page</div>} />
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByText('Admin page')).toBeInTheDocument()
})

test('keeps athlete callback behavior independent of AAL', () => {
  authState.session = { user: { id: 'athlete-1' } }
  authState.profile = { is_admin: false, is_blocked: false, access_mode: 'activity' }
  assuranceState.currentLevel = 'aal1'
  render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <Routes>
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/activity" element={<div>Activity page</div>} />
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByText('Activity page')).toBeInTheDocument()
})
