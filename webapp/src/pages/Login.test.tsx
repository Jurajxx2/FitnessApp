import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Login from './Login'

const { mockSignInWithOtp } = vi.hoisted(() => ({ mockSignInWithOtp: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signInWithOtp: mockSignInWithOtp },
  },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ session: null, isLoading: false }),
}))

test('signs in an existing trainee without creating arbitrary new accounts', async () => {
  mockSignInWithOtp.mockResolvedValue({ error: null })

  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<div>Verify page</div>} />
      </Routes>
    </MemoryRouter>
  )

  await userEvent.type(screen.getByLabelText('Email'), '  TRAINEE@Example.com  ')
  await userEvent.click(screen.getByRole('button', { name: /poslať kód/i }))

  await waitFor(() => expect(screen.getByText('Verify page')).toBeInTheDocument())
  expect(mockSignInWithOtp).toHaveBeenCalledWith({
    email: 'trainee@example.com',
    options: { shouldCreateUser: false },
  })
})
