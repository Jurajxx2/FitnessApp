import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword, { copy as forgotPasswordCopy } from './ForgotPassword'
import ResetPassword, { copy as resetPasswordCopy } from './ResetPassword'

const { mockResetPasswordForEmail, mockUpdateUser, authState } = vi.hoisted(() => ({
  mockResetPasswordForEmail: vi.fn(),
  mockUpdateUser: vi.fn(),
  authState: { session: {} as unknown, isLoading: false },
}))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail: mockResetPasswordForEmail, updateUser: mockUpdateUser } },
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }))

beforeEach(() => {
  vi.clearAllMocks()
  authState.session = {}
  authState.isLoading = false
})

test('sends a normalized password reset request to the reset route', async () => {
  mockResetPasswordForEmail.mockResolvedValue({ error: null })
  render(<MemoryRouter><ForgotPassword /></MemoryRouter>)

  await userEvent.type(screen.getByLabelText('Email address'), ' USER@Example.com ')
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))

  await waitFor(() => expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
    'user@example.com',
    { redirectTo: window.location.origin },
  ))
  expect(screen.getByRole('status')).toHaveTextContent(/check your inbox/i)
})

test('updates the password when the recovery session is present', async () => {
  mockUpdateUser.mockResolvedValue({ error: null })
  render(<MemoryRouter><ResetPassword /></MemoryRouter>)

  await userEvent.type(screen.getByLabelText('New password'), 'new-password-123')
  await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-password-123')
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }))

  await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-password-123' }))
  expect(screen.getByRole('status')).toHaveTextContent(/ready to use/i)
})

test('rejects mismatched passwords without calling Supabase', async () => {
  render(<MemoryRouter><ResetPassword /></MemoryRouter>)

  await userEvent.type(screen.getByLabelText('New password'), 'new-password-123')
  await userEvent.type(screen.getByLabelText('Confirm new password'), 'different-password')
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i)
  expect(mockUpdateUser).not.toHaveBeenCalled()
})

test('maps a compromised reset password to friendly guidance', async () => {
  mockUpdateUser.mockResolvedValue({
    error: {
      code: 'weak_password',
      name: 'AuthWeakPasswordError',
      reasons: ['pwned'],
      message: 'Password is known to be weak',
    },
  })
  render(<MemoryRouter><ResetPassword /></MemoryRouter>)

  await userEvent.type(screen.getByLabelText('New password'), 'compromised-password')
  await userEvent.type(screen.getByLabelText('Confirm new password'), 'compromised-password')
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }))

  expect(await screen.findByRole('alert')).toHaveTextContent(/known data breach/i)
  expect(screen.getByRole('alert')).not.toHaveTextContent(/known to be weak/i)
})

test('ForgotPassword sk and cs copy expose the same key set', () => {
  expect(Object.keys(forgotPasswordCopy.sk).sort()).toEqual(Object.keys(forgotPasswordCopy.cs).sort())
})

test('ResetPassword sk and cs copy expose the same key set', () => {
  expect(Object.keys(resetPasswordCopy.sk).sort()).toEqual(Object.keys(resetPasswordCopy.cs).sort())
})
