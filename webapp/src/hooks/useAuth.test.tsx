import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn(),
  },
}))

function Probe() {
  const { isLoading, session } = useAuth()
  return <div>{isLoading ? 'loading' : session ? 'in' : 'out'}</div>
}

test('resolves to signed-out when no session', async () => {
  render(<AuthProvider><Probe /></AuthProvider>)
  await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())
})
