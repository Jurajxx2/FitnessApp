import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminRouteGuard } from './RouteGuard'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../hooks/useAuth'
const mockUseAuth = vi.mocked(useAuth)

describe('AdminRouteGuard', () => {
  it('shows loading while auth resolves', () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: true, refreshProfile: vi.fn() })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })

  it('redirects to the unified login when no session', () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: false, refreshProfile: vi.fn() })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('redirects authenticated non-admins to the trainee workspace', () => {
    mockUseAuth.mockReturnValue({ session: {} as any, user: {} as any, profile: {} as any, isAdmin: false, isLoading: false, refreshProfile: vi.fn() })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/nutrition" element={<div>Trainee workspace</div>} />
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Trainee workspace')).toBeInTheDocument()
  })

  it('blocks an authenticated profile before routing by role', () => {
    mockUseAuth.mockReturnValue({
      session: {} as any,
      user: {} as any,
      profile: { is_blocked: true } as any,
      isAdmin: false,
      isLoading: false,
      refreshProfile: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Prístup k účtu je zablokovaný')).toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })

  it('renders children when admin', () => {
    mockUseAuth.mockReturnValue({ session: {} as any, user: {} as any, profile: {} as any, isAdmin: true, isLoading: false, refreshProfile: vi.fn() })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })
})
