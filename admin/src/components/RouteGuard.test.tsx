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
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: true })
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

  it('redirects to /auth when no session', () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: false })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/auth" element={<div>Login page</div>} />
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('redirects to /403 when not admin', () => {
    mockUseAuth.mockReturnValue({ session: {} as any, user: {} as any, profile: {} as any, isAdmin: false, isLoading: false })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/403" element={<div>Not admin</div>} />
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Not admin')).toBeInTheDocument()
  })

  it('renders children when admin', () => {
    mockUseAuth.mockReturnValue({ session: {} as any, user: {} as any, profile: {} as any, isAdmin: true, isLoading: false })
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
