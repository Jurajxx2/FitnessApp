import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth, AuthProvider } from './useAuth'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn(),
  },
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    })
    expect(result.current.isLoading).toBe(true)
  })

  it('returns no session when supabase returns null', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 })
    expect(result.current.session).toBeNull()
    expect(result.current.isAdmin).toBe(false)
  })
})
