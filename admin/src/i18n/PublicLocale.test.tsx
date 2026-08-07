import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicLocaleProvider, usePublicLocale } from './PublicLocale'

const STORAGE_KEY = 'coach-foska-public-locale'

function LocaleProbe() {
  const { locale } = usePublicLocale()
  return <span data-testid="locale">{locale}</span>
}

function renderedLocale() {
  render(
    <PublicLocaleProvider>
      <LocaleProbe />
    </PublicLocaleProvider>,
  )
  return screen.getByTestId('locale').textContent
}

function stubLanguage(language: string) {
  Object.defineProperty(window.navigator, 'language', { value: language, configurable: true })
}

describe('initialLocale', () => {
  const originalLanguage = window.navigator.language

  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    stubLanguage(originalLanguage)
  })

  test('defaults to Slovak for sk-SK with empty storage', () => {
    stubLanguage('sk-SK')
    expect(renderedLocale()).toBe('sk')
  })

  test('detects Czech from cs-CZ', () => {
    stubLanguage('cs-CZ')
    expect(renderedLocale()).toBe('cs')
  })

  test('detects English from en-US', () => {
    stubLanguage('en-US')
    expect(renderedLocale()).toBe('en')
  })

  test('falls back to Slovak for an unrelated locale like de-DE', () => {
    stubLanguage('de-DE')
    expect(renderedLocale()).toBe('sk')
  })

  test('a stored locale wins over navigator.language', () => {
    stubLanguage('en-US')
    window.localStorage.setItem(STORAGE_KEY, 'cs')
    expect(renderedLocale()).toBe('cs')
  })

  test('an invalid stored value is ignored in favour of navigator.language', () => {
    stubLanguage('en-US')
    window.localStorage.setItem(STORAGE_KEY, 'fr')
    expect(renderedLocale()).toBe('en')
  })
})

describe('PublicLocaleProvider persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('persists the active locale to localStorage and document.documentElement.lang', () => {
    stubLanguage('sk-SK')
    renderedLocale()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('sk')
    expect(document.documentElement.lang).toBe('sk')
  })
})
