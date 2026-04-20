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
  } catch (err) {
    console.error('useAuth: error in resolveSession', err)
    if (!mounted()) return
    setState({ ...initialState, isLoading: false })
  }
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(initialState)

  useEffect(() => {
    let _mounted = true
    const mounted = () => _mounted

    // Safety timeout: if Supabase's internal locking hangs getSession(),
    // don't block the whole app. Proceed after 1.5s.
    const getSessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise<{data: {session: any}}>((_, reject) => 
      setTimeout(() => reject(new Error('getSession lock timeout')), 1500)
    )

    Promise.race([getSessionPromise, timeoutPromise])
      .then(({ data: { session } }) => {
        return resolveSession(session, (newState) => {
          if (_mounted) setState(newState)
        }, mounted)
      })
      .catch(() => { 
        if (_mounted) setState(s => ({ ...s, isLoading: false }))
      })

    // Subscribe to subsequent auth changes. This often fires even if getSession hangs.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!_mounted) return
      await resolveSession(session, (newState) => {
        if (_mounted) setState(newState)
      }, mounted)
    })

    return () => {
      _mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
