import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AthleteRouteGuard } from './AthleteRouteGuard'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))

import { useAuth } from '../hooks/useAuth'

const mockUseAuth = vi.mocked(useAuth)

test('redirects unauthenticated athletes to /login', () => {
  mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: false })

  render(
    <MemoryRouter initialEntries={['/nutrition']}>
      <Routes>
        <Route path="/login" element={<div>Athlete login</div>} />
        <Route element={<AthleteRouteGuard />}>
          <Route path="/nutrition" element={<div>Athlete portal</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByText('Athlete login')).toBeInTheDocument()
})

test('allows any authenticated athlete session without requiring admin role', () => {
  mockUseAuth.mockReturnValue({
    session: {} as never,
    user: {} as never,
    profile: {} as never,
    isAdmin: false,
    isLoading: false,
  })

  render(
    <MemoryRouter initialEntries={['/nutrition']}>
      <Routes>
        <Route element={<AthleteRouteGuard />}>
          <Route path="/nutrition" element={<div>Athlete portal</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByText('Athlete portal')).toBeInTheDocument()
})

test('blocks an authenticated athlete whose profile is blocked', () => {
  mockUseAuth.mockReturnValue({
    session: {} as never,
    user: {} as never,
    profile: { is_blocked: true } as never,
    isAdmin: false,
    isLoading: false,
  })

  render(
    <MemoryRouter initialEntries={['/nutrition']}>
      <Routes>
        <Route element={<AthleteRouteGuard />}>
          <Route path="/nutrition" element={<div>Athlete portal</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByText('Account access is blocked')).toBeInTheDocument()
  expect(screen.queryByText('Athlete portal')).not.toBeInTheDocument()
})
