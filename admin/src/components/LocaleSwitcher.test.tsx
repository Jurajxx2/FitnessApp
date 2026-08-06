import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PublicLocaleProvider } from '../i18n/PublicLocale'
import { LocaleSwitcher } from './LocaleSwitcher'

function renderSwitcher() {
  return render(
    <PublicLocaleProvider>
      <LocaleSwitcher />
    </PublicLocaleProvider>,
  )
}

test('offers all three locale options', () => {
  renderSwitcher()
  expect(screen.getByRole('button', { name: 'sk' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'cs' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'en' })).toBeInTheDocument()
})

test('marks the active locale as pressed and persists a new choice on click', async () => {
  window.localStorage.setItem('coach-foska-public-locale', 'sk')
  renderSwitcher()

  expect(screen.getByRole('button', { name: 'sk' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'en' })).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(screen.getByRole('button', { name: 'en' }))

  expect(screen.getByRole('button', { name: 'en' })).toHaveAttribute('aria-pressed', 'true')
  expect(window.localStorage.getItem('coach-foska-public-locale')).toBe('en')
  window.localStorage.clear()
})

test('renders all three options at the 44px minimum touch target', () => {
  renderSwitcher()
  for (const name of ['sk', 'cs', 'en']) {
    const button = screen.getByRole('button', { name })
    expect(button.className).toMatch(/\bmin-h-11\b/)
    expect(button.className).toMatch(/\bmin-w-11\b/)
  }
})

test('uses a Slovak group label for sk and cs, and English for en', () => {
  window.localStorage.setItem('coach-foska-public-locale', 'sk')
  const { unmount } = renderSwitcher()
  expect(screen.getByRole('group', { name: 'Jazyk stránky' })).toBeInTheDocument()
  unmount()

  window.localStorage.setItem('coach-foska-public-locale', 'en')
  renderSwitcher()
  expect(screen.getByRole('group', { name: 'Page language' })).toBeInTheDocument()
  window.localStorage.clear()
})
