import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PublicLocaleProvider } from '../i18n/PublicLocale'
import Callback, { copy } from './Callback'

const { mockOnAuthStateChange } = vi.hoisted(() => ({
  mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: mockOnAuthStateChange } },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

function renderCallback() {
  return render(
    <PublicLocaleProvider>
      <MemoryRouter>
        <Callback />
      </MemoryRouter>
    </PublicLocaleProvider>,
  )
}

test('shows the English signing-in message when no PublicLocaleProvider is present', () => {
  render(
    <MemoryRouter>
      <Callback />
    </MemoryRouter>,
  )
  expect(screen.getByText(copy.en.signingIn)).toBeInTheDocument()
})

test('shows the Slovak signing-in message when the stored locale is sk', () => {
  window.localStorage.setItem('coach-foska-public-locale', 'sk')
  renderCallback()
  expect(screen.getByText(copy.sk.signingIn)).toBeInTheDocument()
  window.localStorage.clear()
})

test('sk and cs copy expose the same key set', () => {
  expect(Object.keys(copy.sk).sort()).toEqual(Object.keys(copy.cs).sort())
})
