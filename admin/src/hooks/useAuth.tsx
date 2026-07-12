import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

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
        if (active) setState({ ...initialState, isLoading: false })
        return
      }

      try {
        const profile = await fetchProfile(session.user.id)
        if (!active || currentResolution !== resolutionId) return

        const isAdmin = profile?.is_admin ?? false
        setState({ session, user: session.user, profile, isAdmin, isLoading: false })
        logger.info('Admin session resolved', { isAdmin })
      } catch (err) {
        if (!active || currentResolution !== resolutionId) return
        logger.error('AuthProvider: error in resolveSession', err)
        // Preserve the authenticated identity, but fail closed for admin access.
        setState({ session, user: session.user, profile: null, isAdmin: false, isLoading: false })
      }
    }

    function scheduleSessionResolution(session: Session | null) {
      // Supabase documents a deadlock when another Supabase API call is awaited
      // directly from onAuthStateChange. Move profile resolution to the next task.
      const timer = window.setTimeout(() => {
        pendingTimers.delete(timer)
        void resolveSession(session)
      }, 0)
      pendingTimers.add(timer)
    }

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      // An auth event is newer than this initial snapshot and must win.
      if (!authEventSeen) void resolveSession(session)
    }).catch(err => {
      logger.error('AuthProvider: getSession failed', err)
      if (active) setState(s => ({ ...s, isLoading: false }))
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authEventSeen = true
      logger.info('Auth state changed', { event, hasSession: Boolean(session) })
      scheduleSessionResolution(session)
    })

    return () => {
      active = false
      resolutionId += 1
      pendingTimers.forEach(timer => window.clearTimeout(timer))
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
