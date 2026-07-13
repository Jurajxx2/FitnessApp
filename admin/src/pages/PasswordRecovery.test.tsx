import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from './ForgotPassword'
import ResetPassword from './ResetPassword'

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
