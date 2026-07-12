import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth, AuthProvider } from './useAuth'

const { mockGetSession, mockSingle, mockFrom } = vi.hoisted(() => {
  const mockGetSession = vi.fn()
  const mockSingle = vi.fn()
  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ single: mockSingle })),
    })),
  }))
  return { mockGetSession, mockSingle, mockFrom }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: mockFrom,
  },
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null } })
  })

  it('starts in loading state', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('returns no session when supabase returns null', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 })
    expect(result.current.session).toBeNull()
    expect(result.current.isAdmin).toBe(false)
  })

  it('grants admin UI access only when the profile admin flag is true', async () => {
    const session = { user: { id: 'admin-1' } }
    mockGetSession.mockResolvedValue({ data: { session } })
    mockSingle.mockResolvedValue({ data: { id: 'admin-1', is_admin: true }, error: null })

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.session).toBe(session)
    expect(result.current.isAdmin).toBe(true)
  })

  it('keeps the session but fails closed when the admin profile cannot be read', async () => {
    const session = { user: { id: 'admin-1' } }
    mockGetSession.mockResolvedValue({ data: { session } })
    mockSingle.mockResolvedValue({ data: null, error: new Error('profile unavailable') })

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.session).toBe(session)
    expect(result.current.isAdmin).toBe(false)
  })
})
