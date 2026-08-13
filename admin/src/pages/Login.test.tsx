import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicLocaleProvider } from '../i18n/PublicLocale'
import Login, { copy } from './Login'

const { mockSignInWithPassword, mockSignOut, mockRevokeSession, authState, assuranceState } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockRevokeSession: vi.fn(),
  authState: { session: null as unknown, profile: null as any, isAdmin: false, isLoading: false },
  assuranceState: { currentLevel: 'aal2' as 'aal1' | 'aal2' | null, nextLevel: 'aal2' as 'aal1' | 'aal2' | null, error: null as Error | null, isLoading: false },
}))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: mockSignInWithPassword, signOut: mockSignOut, admin: { signOut: mockRevokeSession } } },
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ ...authState, user: null }),
  useAuthAssurance: () => ({ ...assuranceState, refreshAssuranceLevel: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockSignOut.mockResolvedValue({ error: null })
  mockRevokeSession.mockResolvedValue({ data: null, error: null })
  authState.session = null
  authState.profile = null
  authState.isAdmin = false
  authState.isLoading = false
  assuranceState.currentLevel = 'aal2'
  assuranceState.nextLevel = 'aal2'
  assuranceState.error = null
  assuranceState.isLoading = false
})

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/" element={<div>Landing page</div>} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/otp" element={<div>OTP email page</div>} />
        <Route path="/login/forgot-password" element={<div>Password recovery page</div>} />
        <Route path="/nutrition" element={<div>Nutrition page</div>} />
        <Route path="/admin" element={<div>Dashboard page</div>} />
        <Route path="/admin/mfa" element={<div>MFA page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

test('uses normalized email and password as the primary unified login', async () => {
  mockSignInWithPassword.mockResolvedValue({ data: {}, error: null })
  renderLogin()

  await userEvent.type(screen.getByLabelText('Email address'), ' ADMIN@Example.com ')
  await userEvent.type(screen.getByLabelText('Password'), 'secret-password')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

  await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'admin@example.com', password: 'secret-password' }))
})

test('maps a compromised-password login response to friendly guidance', async () => {
  mockSignInWithPassword.mockResolvedValue({
    data: {},
    error: {
      code: 'weak_password',
      name: 'AuthWeakPasswordError',
      reasons: ['pwned'],
      message: 'Password is known to be weak',
    },
  })
  renderLogin()

  await userEvent.type(screen.getByLabelText('Email address'), 'user@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'compromised-password')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

  expect(await screen.findByRole('alert')).toHaveTextContent(/known data breach/i)
  expect(screen.getByRole('alert')).not.toHaveTextContent(/known to be weak/i)
})

test('ends a session returned with a compromised-password warning', async () => {
  mockSignInWithPassword.mockResolvedValue({
    data: {
      session: { access_token: 'compromised-session-token' },
      weakPassword: { reasons: ['pwned'], message: 'Password is compromised' },
    },
    error: null,
  })
  renderLogin()

  await userEvent.type(screen.getByLabelText('Email address'), 'user@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'compromised-password')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

  await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' }))
  expect(mockRevokeSession).toHaveBeenCalledWith('compromised-session-token', 'global')
  expect(screen.getByRole('alert')).toHaveTextContent(/known data breach/i)
})

test('never navigates a compromised session while local sign-out is slow or failing', async () => {
  let rejectLocalSignOut: (error: Error) => void = () => {}
  mockSignInWithPassword.mockImplementation(async () => {
    authState.session = {} as never
    authState.isAdmin = true
    authState.profile = { is_admin: true, is_blocked: false, access_mode: 'both' }
    return {
      data: {
        session: { access_token: 'compromised-session-token' },
        weakPassword: { reasons: ['pwned'], message: 'Password is compromised' },
      },
      error: null,
    }
  })
  mockSignOut.mockReturnValue(new Promise((_, reject) => { rejectLocalSignOut = reject }))
  mockRevokeSession.mockRejectedValue(new Error('revocation unavailable'))
  renderLogin()

  await userEvent.type(screen.getByLabelText('Email address'), 'user@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'compromised-password')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

  await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' }))
  expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument()

  rejectLocalSignOut(new Error('local storage unavailable'))

  expect(await screen.findByRole('alert')).toHaveTextContent(/known data breach/i)
  expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument()
})

test('opens OTP email collection on a separate page', async () => {
  renderLogin()
  await userEvent.click(screen.getByRole('link', { name: /one-time code/i }))
  expect(screen.getByText('OTP email page')).toBeInTheDocument()
  expect(mockSignInWithPassword).not.toHaveBeenCalled()
})

test('opens password recovery from the password field', async () => {
  renderLogin()
  await userEvent.click(screen.getByRole('link', { name: /forgot password/i }))
  expect(screen.getByText('Password recovery page')).toBeInTheDocument()
})

test('returns to the public website from the explicit back link', async () => {
  renderLogin()
  await userEvent.click(screen.getByRole('link', { name: /back to the website/i }))
  expect(screen.getByText('Landing page')).toBeInTheDocument()
})

test('routes an existing admin session to admin', () => {
  authState.session = {} as never
  authState.isAdmin = true
  authState.profile = { is_admin: true, is_blocked: false, access_mode: 'both' }
  renderLogin()
  expect(screen.getByText('Dashboard page')).toBeInTheDocument()
})

test('routes an existing aal1 admin session to MFA', () => {
  authState.session = {} as never
  authState.isAdmin = true
  authState.profile = { is_admin: true, is_blocked: false, access_mode: 'both' }
  assuranceState.currentLevel = 'aal1'
  assuranceState.nextLevel = 'aal2'
  renderLogin()
  expect(screen.getByText('MFA page')).toBeInTheDocument()
})

test('routes an existing client session to nutrition', () => {
  authState.session = {} as never
  renderLogin()
  expect(screen.getByText('Nutrition page')).toBeInTheDocument()
})

test('renders the Slovak heading when the public locale is sk', () => {
  window.localStorage.setItem('coach-foska-public-locale', 'sk')
  render(
    <PublicLocaleProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    </PublicLocaleProvider>,
  )
  expect(screen.getByRole('heading', { name: 'Prihlásenie do Coach Foska' })).toBeInTheDocument()
  window.localStorage.clear()
})

test('sk and cs copy expose the same key set', () => {
  expect(Object.keys(copy.sk).sort()).toEqual(Object.keys(copy.cs).sort())
})
