import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  isLoading: boolean
}

const initialState: AuthState = {
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  isLoading: true,
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

async function resolveSession(session: Session | null, setState: (s: AuthState) => void, mounted: () => boolean) {
  if (!session) {
    if (mounted()) setState({ ...initialState, isLoading: false })
    return
  }
  try {
    const profile = await fetchProfile(session.user.id)
    if (!mounted()) return
    setState({ session, user: session.user, profile, isAdmin: profile?.is_admin ?? false, isLoading: false })
  } catch {
    if (!mounted()) return
    setState({ ...initialState, isLoading: false })
  }
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(initialState)

  useEffect(() => {
    let _mounted = true
    const mounted = () => _mounted

    // getSession() reliably returns the stored session on page load.
    // INITIAL_SESSION from onAuthStateChange can be missed in React StrictMode
    // (the event fires async; by the time it fires, the first subscription has
    // already been cleaned up and the second one may not receive it).
    supabase.auth.getSession()
      .then(({ data: { session } }) => resolveSession(session, setState, mounted))
      .catch(() => { if (_mounted) setState({ ...initialState, isLoading: false }) })

    // Subscribe to subsequent auth changes (sign-out, token refresh, etc.).
    // INITIAL_SESSION is skipped here — getSession() above handles initial load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!_mounted) return
      if (event === 'INITIAL_SESSION') return
      await resolveSession(session, setState, mounted)
    })

    return () => {
      _mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
