import { useEffect, useState } from 'react'
import type { Factor } from '@supabase/supabase-js'
import { KeyRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { athleteHomePath } from '../lib/access'
import { safeAdminReturnTo, verifiedTotpFactors } from '../lib/mfa'
import { supabase } from '../lib/supabase'

export default function MfaChallenge() {
  const { session, profile, isAdmin, assuranceLevel, isLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = safeAdminReturnTo(searchParams.get('returnTo'))
  const [factors, setFactors] = useState<Factor[]>([])
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [loadingFactors, setLoadingFactors] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!session) {
      navigate('/login', { replace: true })
      return
    }
    if (!isAdmin) {
      navigate(athleteHomePath(profile), { replace: true })
      return
    }
    if (assuranceLevel === 'aal2') {
      navigate(returnTo, { replace: true })
      return
    }

    let active = true
    void supabase.auth.mfa.listFactors().then(({ data, error: factorsError }) => {
      if (!active) return
      if (factorsError) {
        setError('Security keys could not be loaded. Try again.')
      } else {
        const available = verifiedTotpFactors(data?.all)
        setFactors(available)
        setFactorId(available[0]?.id ?? '')
        if (available.length === 0) {
          navigate(`/admin/security?returnTo=${encodeURIComponent(returnTo)}`, { replace: true })
        }
      }
      setLoadingFactors(false)
    })
    return () => { active = false }
  }, [assuranceLevel, isAdmin, isLoading, navigate, profile, returnTo, session])

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault()
    if (!factorId || !/^\d{6}$/.test(code)) return
    setError('')
    setSubmitting(true)
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (verifyError) {
      setError('The code is invalid or expired. Enter a new code from your authenticator app.')
      setSubmitting(false)
      return
    }
    await supabase.auth.refreshSession()
    navigate(returnTo, { replace: true })
  }

  if (isLoading || loadingFactors) {
    return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">Checking account security…</div>
  }

  return (
    <AuthLayout>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-subtle bg-action-secondary text-accent-strong">
        <KeyRound size={22} aria-hidden="true" />
      </div>
      <p className="mb-2 ledger-label text-text-secondary">Admin security</p>
      <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary">Enter your authenticator code</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">Admin tools require a second verification step. Open your authenticator app and enter its current six-digit code.</p>

      <form className="mt-8 flex flex-col gap-5" onSubmit={handleVerify}>
        {factors.length > 1 && (
          <div>
            <label htmlFor="mfa-factor" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Authenticator</label>
            <select id="mfa-factor" value={factorId} onChange={event => setFactorId(event.target.value)} className="h-12 w-full rounded-xl border border-outline bg-surface px-3 text-sm text-text-primary">
              {factors.map(factor => <option key={factor.id} value={factor.id}>{factor.friendly_name || 'Authenticator app'}</option>)}
            </select>
          </div>
        )}
        <Input
          id="mfa-code"
          label="Six-digit code"
          value={code}
          onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          required
          autoFocus
        />
        {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
        <Button type="submit" loading={submitting} disabled={!factorId || code.length !== 6} className="min-h-12 w-full">Verify and continue</Button>
        <Button type="button" variant="secondary" onClick={() => void supabase.auth.signOut()}>Sign out</Button>
      </form>
    </AuthLayout>
  )
}
