import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminMfaRouteGuard, AdminRouteGuard } from './RouteGuard'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  useAuthAssurance: vi.fn(),
}))

import { useAuth, useAuthAssurance } from '../hooks/useAuth'
const mockUseAuth = vi.mocked(useAuth)
const mockUseAuthAssurance = vi.mocked(useAuthAssurance)

const aal2 = {
  currentLevel: 'aal2' as const,
  nextLevel: 'aal2' as const,
  error: null,
  isLoading: false,
  refreshAssuranceLevel: vi.fn(),
}

describe('AdminRouteGuard', () => {
  beforeEach(() => mockUseAuthAssurance.mockReturnValue(aal2))

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

  it('redirects an activity-only non-admin straight to the activity home, not /nutrition', () => {
    mockUseAuth.mockReturnValue({
      session: {} as any,
      user: {} as any,
      profile: { access_mode: 'activity' } as any,
      isAdmin: false,
      isLoading: false,
      refreshProfile: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/activity" element={<div>Activity home</div>} />
          <Route path="/nutrition" element={<div>Trainee workspace</div>} />
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Activity home')).toBeInTheDocument()
    expect(screen.queryByText('Trainee workspace')).not.toBeInTheDocument()
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

  it('redirects an aal1 admin to MFA instead of rendering admin content', () => {
    mockUseAuth.mockReturnValue({ session: {} as any, user: {} as any, profile: { is_admin: true } as any, isAdmin: true, isLoading: false, refreshProfile: vi.fn() })
    mockUseAuthAssurance.mockReturnValue({ ...aal2, currentLevel: 'aal1', nextLevel: 'aal2' })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin/mfa" element={<div>MFA page</div>} />
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('MFA page')).toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })

  it('fails closed to MFA when assurance lookup errors', () => {
    mockUseAuth.mockReturnValue({ session: {} as any, user: {} as any, profile: { is_admin: true } as any, isAdmin: true, isLoading: false, refreshProfile: vi.fn() })
    mockUseAuthAssurance.mockReturnValue({ ...aal2, currentLevel: null, nextLevel: null, error: new Error('AAL unavailable') })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin/mfa" element={<div>MFA page</div>} />
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('MFA page')).toBeInTheDocument()
  })
})

describe('AdminMfaRouteGuard', () => {
  it('allows an authenticated unblocked admin at aal1 to reach MFA', () => {
    mockUseAuth.mockReturnValue({ session: {} as any, user: {} as any, profile: { is_admin: true, is_blocked: false } as any, isAdmin: true, isLoading: false, refreshProfile: vi.fn() })
    render(
      <MemoryRouter initialEntries={['/admin/mfa']}>
        <Routes>
          <Route element={<AdminMfaRouteGuard />}>
            <Route path="/admin/mfa" element={<div>MFA page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('MFA page')).toBeInTheDocument()
  })

  it('blocks a blocked admin before showing recovery controls', () => {
    mockUseAuth.mockReturnValue({ session: {} as any, user: {} as any, profile: { is_admin: true, is_blocked: true } as any, isAdmin: true, isLoading: false, refreshProfile: vi.fn() })
    render(
      <MemoryRouter initialEntries={['/admin/mfa']}>
        <Routes>
          <Route element={<AdminMfaRouteGuard />}>
            <Route path="/admin/mfa" element={<div>MFA page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Prístup k účtu je zablokovaný')).toBeInTheDocument()
    expect(screen.queryByText('MFA page')).not.toBeInTheDocument()
  })
})
