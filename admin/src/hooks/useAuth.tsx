import React, { createContext, useContext, useEffect, useState } from 'react'
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

const AuthContext = createContext<AuthState>(initialState)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)

  async function resolveSession(session: Session | null) {
    if (!session) {
      setState({ ...initialState, isLoading: false })
      return
    }
    try {
      const profile = await fetchProfile(session.user.id)
      setState({ session, user: session.user, profile, isAdmin: profile?.is_admin ?? false, isLoading: false })
    } catch (err) {
      console.error('AuthProvider: error in resolveSession', err)
      setState({ ...initialState, isLoading: false })
    }
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveSession(session)
    }).catch(err => {
      console.error('AuthProvider: getSession failed', err)
      setState(s => ({ ...s, isLoading: false }))
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      resolveSession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
