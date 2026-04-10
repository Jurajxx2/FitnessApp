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

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(initialState)

  useEffect(() => {
    let mounted = true

    // onAuthStateChange fires INITIAL_SESSION on mount — covers the same case
    // as getSession() but without the race condition of two concurrent calls.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!mounted) return
      if (session) {
        try {
          const profile = await fetchProfile(session.user.id)
          if (!mounted) return
          setState({ session, user: session.user, profile, isAdmin: profile?.is_admin ?? false, isLoading: false })
        } catch {
          // Profile fetch failed — treat as unauthenticated rather than hanging
          if (!mounted) return
          setState({ ...initialState, isLoading: false })
        }
      } else {
        setState({ ...initialState, isLoading: false })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
