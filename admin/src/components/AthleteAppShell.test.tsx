import { lazy } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AthleteAppShell } from './AthleteAppShell'

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'athlete@example.com' },
    profile: { full_name: 'Janka Testovacia', access_mode: 'both' },
    isAdmin: false,
  }),
}))
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}))
vi.mock('../chat/athleteApi', () => ({
  countUnreadFromCoach: vi.fn(),
  fetchMyMessages: vi.fn(),
}))

function renderShell() {
  vi.mocked(useQuery).mockReturnValue({ data: 0 } as unknown as ReturnType<typeof useQuery>)
  return render(
    <MemoryRouter initialEntries={['/nutrition']}>
      <Routes>
        <Route element={<AthleteAppShell />}>
          <Route path="/nutrition" element={<p>Nutrition page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AthleteAppShell', () => {
  it('labels both the desktop sidebar nav and the mobile bottom nav in Slovak', () => {
    renderShell()

    const navs = screen.getAllByRole('navigation', { name: 'Hlavná navigácia' })
    expect(navs).toHaveLength(2)
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
  })

  it('renders the Slovak fallback while a lazy athlete route resolves, not the English "Loading workspace…" one', async () => {
    let resolveImport!: (module: { default: () => JSX.Element }) => void
    const importPromise = new Promise<{ default: () => JSX.Element }>(resolve => {
      resolveImport = resolve
    })
    const LazyPage = lazy(() => importPromise)

    vi.mocked(useQuery).mockReturnValue({ data: 0 } as unknown as ReturnType<typeof useQuery>)
    render(
      <MemoryRouter initialEntries={['/nutrition']}>
        <Routes>
          <Route element={<AthleteAppShell />}>
            <Route path="/nutrition" element={<LazyPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Načítavam…')).toBeInTheDocument()
    expect(screen.queryByText('Loading workspace…')).not.toBeInTheDocument()

    resolveImport({ default: () => <p>Loaded content</p> })

    expect(await screen.findByText('Loaded content')).toBeInTheDocument()
    expect(screen.queryByText('Načítavam…')).not.toBeInTheDocument()
  })
})
