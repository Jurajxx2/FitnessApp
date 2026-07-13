import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Login from './Login'

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
        <Route path="/login" element={<Login />} />
        <Route path="/login/otp" element={<div>OTP email page</div>} />
        <Route path="/nutrition" element={<div>Trainee workspace</div>} />
        <Route path="/admin" element={<div>Admin workspace</div>} />
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

test('routes an existing admin session to admin', () => {
  authState.session = {} as never
  authState.isAdmin = true
  renderLogin()
  expect(screen.getByText('Admin workspace')).toBeInTheDocument()
})

test('routes an existing trainee session to the trainee workspace', () => {
  authState.session = {} as never
  renderLogin()
  expect(screen.getByText('Trainee workspace')).toBeInTheDocument()
})
