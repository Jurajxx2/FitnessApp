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
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)

  useEffect(() => {
    let active = true
    let authEventSeen = false
    let resolutionId = 0
    const pendingTimers = new Set<number>()

    async function resolveSession(session: Session | null) {
      const currentResolution = ++resolutionId
      if (!session) {
        // Signed out: drop every cached query so a different account signing in
        // on the same browser can never read the previous user's cached data.
        queryClient.clear()
        if (active) setState({ ...initialState, isLoading: false })
        return
      }

      try {
        const profile = await fetchProfile(session.user.id)
        if (!active || currentResolution !== resolutionId) return
        setState({ session, user: session.user, profile, isLoading: false })
      } catch (err) {
        if (!active || currentResolution !== resolutionId) return
        logger.error('resolveSession failed', err)
        // Keep the session even if the profile row is temporarily unavailable.
        setState({ session, user: session.user, profile: null, isLoading: false })
      }
    }

    function scheduleSessionResolution(session: Session | null) {
      // Do not call another Supabase API from inside onAuthStateChange; the SDK
      // can deadlock. Resolve the profile after the callback has returned.
      const timer = window.setTimeout(() => {
        pendingTimers.delete(timer)
        void resolveSession(session)
      }, 0)
      pendingTimers.add(timer)
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        // An auth event is newer than this initial snapshot and must win.
        if (!authEventSeen) void resolveSession(session)
      })
      .catch(err => {
        logger.error('getSession failed', err)
        if (active) setState(s => ({ ...s, isLoading: false }))
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      authEventSeen = true
      scheduleSessionResolution(session)
    })
    return () => {
      active = false
      resolutionId += 1
      pendingTimers.forEach(timer => window.clearTimeout(timer))
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
