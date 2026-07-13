import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { usePublicLocale } from '../i18n/PublicLocale'
import { athleteHomePath } from '../lib/access'

export default function Callback() {
  const navigate = useNavigate()
  const { locale } = usePublicLocale()

  useEffect(() => {
    let active = true
    const pendingTimers = new Set<number>()

    async function resolveDestination(session: Session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, access_mode')
        .eq('id', session.user.id)
        .single()
      if (active) navigate(profile?.is_admin ? '/admin' : athleteHomePath(profile), { replace: true })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session) return

      // Supabase API calls from inside this callback can deadlock. Defer the
      // profile lookup until after the auth callback returns.
      const timer = window.setTimeout(() => {
        pendingTimers.delete(timer)
        void resolveDestination(session)
      }, 0)
      pendingTimers.add(timer)
    })

    return () => {
      active = false
      pendingTimers.forEach(timer => window.clearTimeout(timer))
      subscription.unsubscribe()
    }
  }, [navigate])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <p className="text-sm text-text-secondary">{locale === 'cs' ? 'Přihlašuji vás…' : 'Signing you in…'}</p>
    </div>
  )
}
