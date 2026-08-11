import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach } from 'vitest'
import { appRoutes } from './App'

// This is a routing-table smoke test, not a page test: leaf pages and the
// two chrome layouts are replaced with markers so a failure here can only
// mean the route tree itself (paths, nesting, guards) was mis-assembled by
// the createBrowserRouter migration — not that some unrelated page broke.
vi.mock('./hooks/useAuth', () => ({ useAuth: vi.fn(), useAuthAssurance: vi.fn() }))
vi.mock('./lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('./pages/Landing', () => ({ default: () => <div>Landing page marker</div> }))
vi.mock('./pages/Login', () => ({ default: () => <div>Login page marker</div> }))
vi.mock('./pages/nutrition/Hub', () => ({ default: () => <div>Nutrition hub marker</div> }))
vi.mock('./pages/admin/Dashboard', () => ({ default: () => <div>Admin dashboard marker</div> }))
vi.mock('./pages/NotFound', () => ({ default: () => <div>Not found marker</div> }))
vi.mock('./pages/AdminMfa', () => ({ default: () => <div>Admin MFA marker</div> }))
vi.mock('./components/AthleteAppShell', async () => {
  const { Outlet } = await import('react-router-dom')
  return { AthleteAppShell: () => <Outlet /> }
})
vi.mock('./components/AdminLayout', async () => {
  const { Outlet } = await import('react-router-dom')
  return { AdminLayout: () => <Outlet /> }
})

import { useAuth, useAuthAssurance } from './hooks/useAuth'
const mockUseAuth = vi.mocked(useAuth)
const mockUseAuthAssurance = vi.mocked(useAuthAssurance)

beforeEach(() => {
  mockUseAuthAssurance.mockReturnValue({
    currentLevel: 'aal2',
    nextLevel: 'aal2',
    error: null,
    isLoading: false,
    refreshAssuranceLevel: vi.fn(),
  })
})

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('App route table (createBrowserRouter migration)', () => {
  test('resolves a public route directly to its page', async () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: false, refreshProfile: vi.fn() })

    renderAt('/')

    expect(await screen.findByText('Landing page marker')).toBeInTheDocument()
  })

  test('resolves an athlete route behind AthleteRouteGuard for an authenticated athlete', async () => {
    mockUseAuth.mockReturnValue({
      session: {} as any,
      user: {} as any,
      profile: {} as any,
      isAdmin: false,
      isLoading: false,
      refreshProfile: vi.fn(),
    })

    renderAt('/nutrition')

    expect(await screen.findByText('Nutrition hub marker')).toBeInTheDocument()
  })

  test('AthleteRouteGuard denies an unauthenticated user, redirecting to /login', async () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: false, refreshProfile: vi.fn() })

    renderAt('/nutrition')

    expect(await screen.findByText('Login page marker')).toBeInTheDocument()
    expect(screen.queryByText('Nutrition hub marker')).not.toBeInTheDocument()
  })

  test('AthleteRouteGuard shows a loading state instead of redirecting while the session resolves', async () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: true, refreshProfile: vi.fn() })

    renderAt('/nutrition')

    expect(await screen.findByText('Načítava sa…')).toBeInTheDocument()
    expect(screen.queryByText('Login page marker')).not.toBeInTheDocument()
    expect(screen.queryByText('Nutrition hub marker')).not.toBeInTheDocument()
  })

  test('resolves an admin route behind AdminRouteGuard for an authenticated admin', async () => {
    mockUseAuth.mockReturnValue({
      session: {} as any,
      user: {} as any,
      profile: {} as any,
      isAdmin: true,
      isLoading: false,
      refreshProfile: vi.fn(),
    })

    renderAt('/admin')

    expect(await screen.findByText('Admin dashboard marker')).toBeInTheDocument()
  })

  test('routes an aal1 admin to the MFA route outside the admin content guard', async () => {
    mockUseAuth.mockReturnValue({
      session: {} as any,
      user: {} as any,
      profile: { is_admin: true, is_blocked: false } as any,
      isAdmin: true,
      isLoading: false,
      refreshProfile: vi.fn(),
    })
    mockUseAuthAssurance.mockReturnValue({
      currentLevel: 'aal1',
      nextLevel: 'aal2',
      error: null,
      isLoading: false,
      refreshAssuranceLevel: vi.fn(),
    })

    renderAt('/admin')

    expect(await screen.findByText('Admin MFA marker')).toBeInTheDocument()
    expect(screen.queryByText('Admin dashboard marker')).not.toBeInTheDocument()
  })

  test('AdminRouteGuard denies an authenticated non-admin, redirecting to the athlete home', async () => {
    mockUseAuth.mockReturnValue({
      session: {} as any,
      user: {} as any,
      profile: {} as any,
      isAdmin: false,
      isLoading: false,
      refreshProfile: vi.fn(),
    })

    renderAt('/admin')

    expect(await screen.findByText('Nutrition hub marker')).toBeInTheDocument()
    expect(screen.queryByText('Admin dashboard marker')).not.toBeInTheDocument()
  })

  test('AdminRouteGuard shows a loading state instead of redirecting while the session resolves', async () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: true, refreshProfile: vi.fn() })

    renderAt('/admin')

    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Login page marker')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin dashboard marker')).not.toBeInTheDocument()
  })

  test('falls back to the 404 page for an unmatched path', async () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, profile: null, isAdmin: false, isLoading: false, refreshProfile: vi.fn() })

    renderAt('/this-path-does-not-exist')

    expect(await screen.findByText('Not found marker')).toBeInTheDocument()
  })
})
