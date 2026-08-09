import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PublicLocaleProvider } from '../i18n/PublicLocale'
import { AuthLayout, copy } from './AuthLayout'

function renderLayout() {
  return render(
    <PublicLocaleProvider>
      <MemoryRouter>
        <AuthLayout>
          <p>Form content</p>
        </AuthLayout>
      </MemoryRouter>
    </PublicLocaleProvider>,
  )
}

test('renders the English copy by default and the wrapped children', () => {
  renderLayout()
  expect(screen.getByRole('heading', { name: 'Your plan, progress and coaching in one place.' })).toBeInTheDocument()
  expect(screen.getByText('Form content')).toBeInTheDocument()
})

test('renders the Slovak copy when the stored locale is sk', () => {
  window.localStorage.setItem('coach-foska-public-locale', 'sk')
  renderLayout()
  expect(screen.getByRole('heading', { name: 'Tvoj plán, pokrok a spolupráca s trénerkou na jednom mieste.' })).toBeInTheDocument()
  window.localStorage.clear()
})

test('sk and cs copy expose the same key set', () => {
  expect(Object.keys(copy.sk).sort()).toEqual(Object.keys(copy.cs).sort())
})
