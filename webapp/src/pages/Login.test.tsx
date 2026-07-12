import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Login from './Login'

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
  useAuth: () => ({ session: null, isLoading: false }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<div>Verify page</div>} />
        <Route path="/nutrition" element={<div>Nutrition page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

test('uses email and password as the primary login path', async () => {
  mockSignInWithPassword.mockResolvedValue({ error: null })

  renderLogin()

  await userEvent.type(screen.getByLabelText('Email'), '  TRAINEE@Example.com  ')
  await userEvent.type(screen.getByLabelText('Heslo'), 'secret-password')
  await userEvent.click(screen.getByRole('button', { name: /^prihlásiť sa →$/i }))

  await waitFor(() => expect(screen.getByText('Nutrition page')).toBeInTheDocument())
  expect(mockSignInWithPassword).toHaveBeenCalledWith({
    email: 'trainee@example.com',
    password: 'secret-password',
  })
  expect(mockSignInWithOtp).not.toHaveBeenCalled()
})

test('keeps OTP login as a secondary option without creating arbitrary new accounts', async () => {
  mockSignInWithOtp.mockResolvedValue({ error: null })

  renderLogin()

  await userEvent.type(screen.getByLabelText('Email'), '  TRAINEE@Example.com  ')
  await userEvent.click(screen.getByRole('button', { name: /jednorazovým kódom/i }))

  await waitFor(() => expect(screen.getByText('Verify page')).toBeInTheDocument())
  expect(mockSignInWithOtp).toHaveBeenCalledWith({
    email: 'trainee@example.com',
    options: { shouldCreateUser: false },
  })
  expect(mockSignInWithPassword).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('otp-email')).toBe('trainee@example.com')
})

test('shows a password login error and stays on the login screen', async () => {
  mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })

  renderLogin()

  await userEvent.type(screen.getByLabelText('Email'), 'trainee@example.com')
  await userEvent.type(screen.getByLabelText('Heslo'), 'wrong-password')
  await userEvent.click(screen.getByRole('button', { name: /^prihlásiť sa →$/i }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
  expect(screen.queryByText('Nutrition page')).not.toBeInTheDocument()
})
