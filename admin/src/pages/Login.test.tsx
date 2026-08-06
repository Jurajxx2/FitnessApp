import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicLocaleProvider } from '../i18n/PublicLocale'
import Login, { copy } from './Login'

const { mockSignInWithPassword, authState } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  authState: { session: null as unknown, isAdmin: false, isLoading: false },
}))

vi.mock('../lib/supabase', () => ({ supabase: { auth: { signInWithPassword: mockSignInWithPassword } } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ ...authState, user: null, profile: null }) }))

beforeEach(() => {
  vi.clearAllMocks()
  authState.session = null
  authState.isAdmin = false
  authState.isLoading = false
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
      </Routes>
    </MemoryRouter>,
  )
}

test('uses normalized email and password as the primary unified login', async () => {
  mockSignInWithPassword.mockResolvedValue({ error: null })
  renderLogin()

  await userEvent.type(screen.getByLabelText('Email address'), ' ADMIN@Example.com ')
  await userEvent.type(screen.getByLabelText('Password'), 'secret-password')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

  await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'admin@example.com', password: 'secret-password' }))
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
  renderLogin()
  expect(screen.getByText('Dashboard page')).toBeInTheDocument()
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
