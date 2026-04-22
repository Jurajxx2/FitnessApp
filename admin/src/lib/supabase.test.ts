import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Intercept createClient so we can inspect what options were passed without
// needing real Supabase credentials or network access.
const mockCreateClient = vi.fn(() => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }))

describe('supabase client config', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    mockCreateClient.mockReturnValue({})
    await import('./supabase')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('configures a lock function to prevent navigator.locks hangs', () => {
    const [,, options] = mockCreateClient.mock.calls[0]
    expect(options.auth.lock).toBeTypeOf('function')
  })

  it('lock executes fn immediately without acquiring any real lock', async () => {
    const [,, options] = mockCreateClient.mock.calls[0]
    const fn = vi.fn().mockResolvedValue('result')
    const result = await options.auth.lock('supabase-auth-token', 5000, fn)
    expect(fn).toHaveBeenCalledOnce()
    expect(result).toBe('result')
  })

  it('lock propagates rejection from fn', async () => {
    const [,, options] = mockCreateClient.mock.calls[0]
    const fn = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(options.auth.lock('name', 5000, fn)).rejects.toThrow('boom')
  })
})
