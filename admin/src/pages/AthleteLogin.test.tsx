import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AthleteLogin from './AthleteLogin'

const { mockSignInWithPassword, mockSignInWithOtp } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignInWithOtp: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOtp: mockSignInWithOtp,
    },
  },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    session: null,
    user: null,
    profile: null,
    isAdmin: false,
    isLoading: false,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<AthleteLogin />} />
        <Route path="/verify" element={<div>Verify page</div>} />
        <Route path="/nutrition" element={<div>Athlete portal</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

test('uses email and password as the primary athlete login', async () => {
  mockSignInWithPassword.mockResolvedValue({ error: null })
  renderLogin()

  await userEvent.type(screen.getByLabelText('Email'), ' ATHLETE@Example.com ')
  await userEvent.type(screen.getByLabelText('Heslo'), 'secret-password')
  await userEvent.click(screen.getByRole('button', { name: 'Prihlásiť sa →' }))

  await waitFor(() => expect(screen.getByText('Athlete portal')).toBeInTheDocument())
  expect(mockSignInWithPassword).toHaveBeenCalledWith({
    email: 'athlete@example.com',
    password: 'secret-password',
  })
  expect(mockSignInWithOtp).not.toHaveBeenCalled()
})

test('keeps OTP as a secondary login without creating users', async () => {
  mockSignInWithOtp.mockResolvedValue({ error: null })
  renderLogin()

  await userEvent.type(screen.getByLabelText('Email'), 'athlete@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Prihlásiť sa jednorazovým kódom' }))

  await waitFor(() => expect(screen.getByText('Verify page')).toBeInTheDocument())
  expect(mockSignInWithOtp).toHaveBeenCalledWith({
    email: 'athlete@example.com',
    options: { shouldCreateUser: false },
  })
  expect(sessionStorage.getItem('otp-email')).toBe('athlete@example.com')
})

test('shows password login errors without leaving the page', async () => {
  mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
  renderLogin()

  await userEvent.type(screen.getByLabelText('Email'), 'athlete@example.com')
  await userEvent.type(screen.getByLabelText('Heslo'), 'wrong-password')
  await userEvent.click(screen.getByRole('button', { name: 'Prihlásiť sa →' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
  expect(screen.queryByText('Athlete portal')).not.toBeInTheDocument()
})
