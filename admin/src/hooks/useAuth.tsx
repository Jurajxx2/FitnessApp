import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { PROFILE_SELECT } from '../profile/selects'
import type { Profile } from '../types/database'
import type { AuthenticatorAssuranceLevel } from '../lib/authDestination'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  refreshProfile: () => Promise<void>
}

interface AuthAssuranceState {
  currentLevel: AuthenticatorAssuranceLevel
  nextLevel: AuthenticatorAssuranceLevel
  error: Error | null
  isLoading: boolean
}

interface AuthAssuranceContextValue extends AuthAssuranceState {
  refreshAssuranceLevel: () => Promise<AuthAssuranceState>
}

const initialState: AuthState = {
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  isLoading: true,
}

const AuthContext = createContext<AuthContextValue>({
  ...initialState,
  refreshProfile: async () => {},
})

const initialAssuranceState: AuthAssuranceState = {
  currentLevel: null,
  nextLevel: null,
  error: null,
  isLoading: true,
}

const AuthAssuranceContext = createContext<AuthAssuranceContextValue>({
  ...initialAssuranceState,
  refreshAssuranceLevel: async () => ({ ...initialAssuranceState, isLoading: false }),
})

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Authenticator assurance level could not be resolved.')
}

async function fetchAssuranceLevel(): Promise<AuthAssuranceState> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error) throw error
    return {
      currentLevel: data.currentLevel,
      nextLevel: data.nextLevel,
      error: null,
      isLoading: false,
    }
  } catch (error) {
    return {
      currentLevel: null,
      nextLevel: null,
      error: toError(error),
      isLoading: false,
    }
  }
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)
  const [assuranceState, setAssuranceState] = useState<AuthAssuranceState>(initialAssuranceState)

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    const profile = await fetchProfile(state.user.id)
    setState(current => ({
      ...current,
      profile,
      isAdmin: profile?.is_admin ?? false,
    }))
  }, [state.user])

  const refreshAssuranceLevel = useCallback(async () => {
    if (!state.session) {
      const signedOutState = { ...initialAssuranceState, isLoading: false }
      setAssuranceState(signedOutState)
      return signedOutState
    }
    setAssuranceState(current => ({ ...current, error: null, isLoading: true }))
    const nextState = await fetchAssuranceLevel()
    setAssuranceState(nextState)
    return nextState
  }, [state.session])

  useEffect(() => {
    let active = true
    let authEventSeen = false
    let resolutionId = 0
    const pendingTimers = new Set<number>()

    async function resolveSession(session: Session | null) {
      const currentResolution = ++resolutionId
      if (!session) {
        if (active) {
          setState({ ...initialState, isLoading: false })
          setAssuranceState({ ...initialAssuranceState, isLoading: false })
        }
        return
      }

      try {
        const [profile, assurance] = await Promise.all([
          fetchProfile(session.user.id),
          fetchAssuranceLevel(),
        ])
        if (!active || currentResolution !== resolutionId) return

        const isAdmin = profile?.is_admin ?? false
        setState({ session, user: session.user, profile, isAdmin, isLoading: false })
        setAssuranceState(assurance)
        logger.info('Admin session resolved', { isAdmin })
      } catch (err) {
        if (!active || currentResolution !== resolutionId) return
        logger.error('AuthProvider: error in resolveSession', err)
        // Preserve the authenticated identity, but fail closed for admin access.
        setState({ session, user: session.user, profile: null, isAdmin: false, isLoading: false })
        // Profile lookup failed before the combined result could be applied.
        // Resolve AAL independently so later profile retries do not leave stale state.
        const assurance = await fetchAssuranceLevel()
        if (active && currentResolution === resolutionId) setAssuranceState(assurance)
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
      if (active) {
        setState(s => ({ ...s, isLoading: false }))
        setAssuranceState({ ...initialAssuranceState, isLoading: false, error: toError(err) })
      }
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
    <AuthContext.Provider value={{ ...state, refreshProfile }}>
      <AuthAssuranceContext.Provider value={{ ...assuranceState, refreshAssuranceLevel }}>
        {children}
      </AuthAssuranceContext.Provider>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthAssurance() {
  return useContext(AuthAssuranceContext)
}
