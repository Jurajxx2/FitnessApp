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

test('odošle normalizovanú žiadosť na správnu návratovú adresu', async () => {
  mockResetPasswordForEmail.mockResolvedValue({ error: null })
  render(<MemoryRouter><ForgotPassword /></MemoryRouter>)

  await userEvent.type(screen.getByLabelText('Email'), ' USER@Example.com ')
  await userEvent.click(screen.getByRole('button', { name: /poslať odkaz/i }))

  await waitFor(() => expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
    'user@example.com',
    { redirectTo: window.location.origin },
  ))
  expect(screen.getByRole('status')).toHaveTextContent(/skontroluj si doručenú poštu/i)
})

test('uloží nové heslo pri platnej relácii obnovy', async () => {
  mockUpdateUser.mockResolvedValue({ error: null })
  render(<MemoryRouter><ResetPassword /></MemoryRouter>)

  await userEvent.type(screen.getByLabelText('Nové heslo'), 'new-password-123')
  await userEvent.type(screen.getByLabelText('Potvrď nové heslo'), 'new-password-123')
  await userEvent.click(screen.getByRole('button', { name: /uložiť nové heslo/i }))

  await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-password-123' }))
  expect(screen.getByRole('status')).toHaveTextContent(/pripravené na použitie/i)
})
