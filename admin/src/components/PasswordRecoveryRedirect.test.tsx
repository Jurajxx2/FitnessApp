import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PasswordRecoveryRedirect } from './PasswordRecoveryRedirect'

const { mockOnAuthStateChange, callbackState } = vi.hoisted(() => ({
  mockOnAuthStateChange: vi.fn(),
  callbackState: { callback: null as null | ((event: string) => void) },
}))

vi.mock('../lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: mockOnAuthStateChange } } }))

beforeEach(() => {
  vi.clearAllMocks()
  callbackState.callback = null
  mockOnAuthStateChange.mockImplementation((callback: (event: string) => void) => {
    callbackState.callback = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
})

test('opens the new-password screen after Supabase confirms password recovery', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <PasswordRecoveryRedirect />
      <Routes>
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/login/reset-password" element={<div>New password page</div>} />
      </Routes>
    </MemoryRouter>,
  )

  act(() => callbackState.callback?.('PASSWORD_RECOVERY'))
  expect(screen.getByText('New password page')).toBeInTheDocument()
})
