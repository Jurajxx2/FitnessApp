import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { queryClient } from '../lib/queryClient'
import type { Profile } from '../types/database'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
}

const initialState: AuthState = { session: null, user: null, profile: null, isLoading: true }
const AuthContext = createContext<AuthState>(initialState)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)

  async function resolveSession(session: Session | null) {
    if (!session) {
      // Signed out: drop every cached query so a different account signing in
      // on the same browser can never read the previous user's cached data
      // (query keys are per-user, but stale entries would otherwise linger).
      queryClient.clear()
      setState({ ...initialState, isLoading: false })
      return
    }
    try {
      const profile = await fetchProfile(session.user.id)
      setState({ session, user: session.user, profile, isLoading: false })
    } catch (err) {
      logger.error('resolveSession failed', err)
      // Keep the session even if the profile row is missing (new user).
      setState({ session, user: session.user, profile: null, isLoading: false })
    }
  }

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => resolveSession(session))
      .catch(err => { logger.error('getSession failed', err); setState(s => ({ ...s, isLoading: false })) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => resolveSession(session))
    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
