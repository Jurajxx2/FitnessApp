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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      if (session) {
        const profile = await fetchProfile(session.user.id)
        setState({ session, user: session.user, profile, isAdmin: profile?.is_admin ?? false, isLoading: false })
      } else {
        setState({ ...initialState, isLoading: false })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!mounted) return
      if (session) {
        const profile = await fetchProfile(session.user.id)
        setState({ session, user: session.user, profile, isAdmin: profile?.is_admin ?? false, isLoading: false })
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
