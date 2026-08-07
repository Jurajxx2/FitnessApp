import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type PublicLocale = 'sk' | 'cs' | 'en'

type PublicLocaleValue = {
  locale: PublicLocale
  setLocale: (locale: PublicLocale) => void
}
const PublicLocaleContext = createContext<PublicLocaleValue>({
  locale: 'en',
  setLocale: () => undefined,
})

function initialLocale(): PublicLocale {
  try {
    const storedLocale = window.localStorage.getItem('coach-foska-public-locale')
    if (storedLocale === 'sk' || storedLocale === 'cs' || storedLocale === 'en') return storedLocale
  } catch {
    // Storage may be unavailable in privacy-focused browser modes.
  }

  const language = window.navigator.language.toLowerCase()
  if (language.startsWith('cs')) return 'cs'
  if (language.startsWith('en')) return 'en'
  // Slovak is the default: it is the primary market and the athlete app beyond
  // this public surface is Slovak-only.
  return 'sk'
}

export function PublicLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<PublicLocale>(initialLocale)

  useEffect(() => {
    document.documentElement.lang = locale
    try {
      window.localStorage.setItem('coach-foska-public-locale', locale)
    } catch {
      // Locale still works for the current page when persistence is unavailable.
    }
  }, [locale])

  return (
    <PublicLocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </PublicLocaleContext.Provider>
  )
}

export function usePublicLocale() {
  return useContext(PublicLocaleContext)
}
