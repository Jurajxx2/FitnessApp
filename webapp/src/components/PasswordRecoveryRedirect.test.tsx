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

test('otvorí obrazovku nového hesla po potvrdení obnovy', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <PasswordRecoveryRedirect />
      <Routes>
        <Route path="/" element={<div>Domov</div>} />
        <Route path="/login/reset-password" element={<div>Nové heslo</div>} />
      </Routes>
    </MemoryRouter>,
  )

  act(() => callbackState.callback?.('PASSWORD_RECOVERY'))
  expect(screen.getByText('Nové heslo')).toBeInTheDocument()
})
