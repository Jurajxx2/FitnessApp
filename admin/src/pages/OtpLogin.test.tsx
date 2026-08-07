import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OtpLogin, { copy } from './OtpLogin'

const { mockSignInWithOtp } = vi.hoisted(() => ({ mockSignInWithOtp: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signInWithOtp: mockSignInWithOtp } } }))

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

test('sends OTP without creating users and advances to verification', async () => {
  mockSignInWithOtp.mockResolvedValue({ error: null })
  render(
    <MemoryRouter initialEntries={['/login/otp']}>
      <Routes>
        <Route path="/login/otp" element={<OtpLogin />} />
        <Route path="/login/verify" element={<div>Verify code page</div>} />
      </Routes>
    </MemoryRouter>,
  )

  await userEvent.type(screen.getByLabelText('Email address'), ' USER@Example.com ')
  await userEvent.click(screen.getByRole('button', { name: /send login code/i }))

  await waitFor(() => expect(screen.getByText('Verify code page')).toBeInTheDocument())
  expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'user@example.com', options: { shouldCreateUser: false } })
  expect(sessionStorage.getItem('otp-email')).toBe('user@example.com')
})

test('sk and cs copy expose the same key set', () => {
  expect(Object.keys(copy.sk).sort()).toEqual(Object.keys(copy.cs).sort())
})
