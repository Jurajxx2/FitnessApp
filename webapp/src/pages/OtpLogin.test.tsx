import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OtpLogin from './OtpLogin'

const { mockSignInWithOtp } = vi.hoisted(() => ({ mockSignInWithOtp: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signInWithOtp: mockSignInWithOtp } } }))

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

test('sends a login code without creating an account', async () => {
  mockSignInWithOtp.mockResolvedValue({ error: null })
  render(
    <MemoryRouter initialEntries={['/login/otp']}>
      <Routes>
        <Route path="/login/otp" element={<OtpLogin />} />
        <Route path="/login/verify" element={<div>Verify page</div>} />
      </Routes>
    </MemoryRouter>,
  )

  await userEvent.type(screen.getByLabelText('Email'), ' TRAINEE@Example.com ')
  await userEvent.click(screen.getByRole('button', { name: /poslať prihlasovací kód/i }))

  await waitFor(() => expect(screen.getByText('Verify page')).toBeInTheDocument())
  expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'trainee@example.com', options: { shouldCreateUser: false } })
  expect(sessionStorage.getItem('otp-email')).toBe('trainee@example.com')
})
