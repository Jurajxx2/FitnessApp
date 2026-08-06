import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PublicLocaleProvider } from '../i18n/PublicLocale'
import NotAdmin, { copy } from './NotAdmin'

vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))

function renderNotAdmin() {
  return render(
    <PublicLocaleProvider>
      <MemoryRouter>
        <NotAdmin />
      </MemoryRouter>
    </PublicLocaleProvider>,
  )
}

test('renders the Slovak copy when the stored locale is sk', () => {
  window.localStorage.setItem('coach-foska-public-locale', 'sk')
  renderNotAdmin()
  expect(screen.getByRole('heading', { name: copy.sk.title })).toBeInTheDocument()
  expect(screen.getByText(copy.sk.body)).toBeInTheDocument()
  window.localStorage.clear()
})

test('sk and cs copy expose the same key set', () => {
  expect(Object.keys(copy.sk).sort()).toEqual(Object.keys(copy.cs).sort())
})
