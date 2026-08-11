import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import Profile from './Profile'
import { supabase } from '../lib/supabase'
import type { Profile as ProfileRecord } from '../types/database'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn() }, from: vi.fn() },
}))

const mockProfile: ProfileRecord = {
  id: 'user-1',
  email: 'athlete@example.com',
  full_name: 'Janka Testovacia',
  age: 28,
  height_cm: 170,
  weight_kg: 65,
  goal: 'stay_fit',
  activity_level: 'moderately_active',
  onboarding_complete: true,
  is_admin: false,
  is_blocked: false,
  access_mode: 'both',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const toggleTheme = vi.fn()
const themeState: { theme: 'dark' | 'light' } = { theme: 'dark' }

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'athlete@example.com' },
    profile: mockProfile,
    refreshProfile: vi.fn(),
  }),
}))
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: themeState.theme, toggleTheme }),
}))

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Profile account controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    themeState.theme = 'dark'
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: false } as any)
    vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as any)
  })
  afterEach(() => cleanup())

  it('signs out and navigates to /login when "Odhlásiť sa" is clicked', async () => {
    renderProfile()

    const signOutButton = screen.getByRole('button', { name: 'Odhlásiť sa' })
    fireEvent.click(signOutButton)

    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalled())
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })

  it('shows "Tmavý vzhľad" for dark theme and calls toggleTheme on click', () => {
    themeState.theme = 'dark'
    renderProfile()

    const themeButton = screen.getByRole('button', { name: 'Tmavý vzhľad' })
    fireEvent.click(themeButton)

    expect(toggleTheme).toHaveBeenCalledTimes(1)
  })

  it('shows "Svetlý vzhľad" for light theme', () => {
    themeState.theme = 'light'
    renderProfile()

    expect(screen.getByRole('button', { name: 'Svetlý vzhľad' })).toBeInTheDocument()
  })

  it('renders both controls without a hidden class at every breakpoint', () => {
    renderProfile()

    const signOutButton = screen.getByRole('button', { name: 'Odhlásiť sa' })
    const themeButton = screen.getByRole('button', { name: 'Tmavý vzhľad' })

    expect(signOutButton.className).not.toMatch(/\bhidden\b/)
    expect(themeButton.className).not.toMatch(/\bhidden\b/)
  })
})
