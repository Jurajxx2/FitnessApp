import { useCallback, useEffect, useState } from 'react'
import type { Factor } from '@supabase/supabase-js'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Input } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { qrCodeDataUrl, safeAdminReturnTo, verifiedTotpFactors } from '../../lib/mfa'
import { supabase } from '../../lib/supabase'

interface PendingEnrollment {
  id: string
  qrCode: string
  secret: string
}

export default function Security() {
  const { assuranceLevel } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = safeAdminReturnTo(searchParams.get('returnTo'))
  const [factors, setFactors] = useState<Factor[]>([])
  const [unfinishedFactors, setUnfinishedFactors] = useState<Factor[]>([])
  const [pending, setPending] = useState<PendingEnrollment | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadFactors = useCallback(async () => {
    const { data, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError) throw factorsError
    setFactors(verifiedTotpFactors(data.all))
    setUnfinishedFactors(data.all.filter(factor => factor.factor_type === 'totp' && factor.status === 'unverified'))
  }, [])

  useEffect(() => {
    let active = true
    void loadFactors()
      .catch(() => { if (active) setError('Security settings could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [loadFactors])

  async function startEnrollment() {
    setError('')
    setSubmitting(true)
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Coach Foska admin ${factors.length + unfinishedFactors.length + 1}`,
    })
    if (enrollError) {
      setError('A new authenticator could not be created. Remove an unfinished factor or try again.')
    } else {
      setPending({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    }
    setSubmitting(false)
  }

  async function verifyEnrollment(event: React.FormEvent) {
    event.preventDefault()
    if (!pending || !/^\d{6}$/.test(code)) return
    setSubmitting(true)
    setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: pending.id, code })
    if (verifyError) {
      setError('The code is invalid or expired. Enter the current code from your authenticator app.')
      setSubmitting(false)
      return
    }
    await supabase.auth.refreshSession()
    setPending(null)
    setCode('')
    await loadFactors()
    setSubmitting(false)
    navigate(returnTo, { replace: true })
  }

  async function cancelEnrollment() {
    if (!pending) return
    setSubmitting(true)
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: pending.id })
    if (unenrollError) setError('The unfinished authenticator could not be removed.')
    else {
      setPending(null)
      setCode('')
    }
    setSubmitting(false)
  }

  async function removeFactor(factorId: string, verified = true) {
    setError('')
    setSubmitting(true)
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
    if (unenrollError) {
      setError(verified && assuranceLevel !== 'aal2' ? 'Verify with an authenticator before removing a verified factor.' : 'The authenticator could not be removed.')
    } else {
      await supabase.auth.refreshSession()
      await loadFactors()
    }
    setSubmitting(false)
  }

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">Loading security settings…</div>

  return (
    <main className="min-h-dvh bg-background px-5 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-action-secondary text-accent-strong"><ShieldCheck size={22} aria-hidden="true" /></span>
          <div><p className="ledger-label text-text-secondary">Admin account</p><h1 className="font-display text-3xl font-bold text-text-primary">Security</h1></div>
        </div>

        {assuranceLevel !== 'aal2' && factors.length > 0 && !pending && (
          <Card className="mb-5 border-accent/40">
            <h2 className="text-base font-bold text-text-primary">Verification required</h2>
            <p className="mt-1 text-sm text-text-secondary">Verify an enrolled authenticator before opening admin tools or changing verified factors.</p>
            <Button className="mt-4" onClick={() => navigate(`/login/mfa?returnTo=${encodeURIComponent(returnTo)}`)}>Enter authenticator code</Button>
          </Card>
        )}

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="flex items-center gap-2 text-base font-bold text-text-primary"><KeyRound size={18} aria-hidden="true" /> Authenticator apps</h2><p className="mt-1 text-sm leading-6 text-text-secondary">A time-based code is required for every admin session. Keep a second authenticator enrolled as a recovery path.</p></div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${assuranceLevel === 'aal2' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{assuranceLevel === 'aal2' ? 'Verified' : 'Needs verification'}</span>
          </div>

          <div className="mt-5 space-y-3">
            {factors.length === 0 && !pending && <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-text-primary">No verified authenticator is enrolled. Enroll one before MFA enforcement is deployed, or the admin account will be locked out.</p>}
            {factors.map(factor => (
              <div key={factor.id} className="flex items-center justify-between gap-4 rounded-xl border border-outline-subtle p-3">
                <div><p className="text-sm font-semibold text-text-primary">{factor.friendly_name || 'Authenticator app'}</p><p className="text-xs text-text-secondary">Verified authenticator</p></div>
                <Button type="button" variant="secondary" disabled={submitting || assuranceLevel !== 'aal2'} onClick={() => void removeFactor(factor.id)}>Remove</Button>
              </div>
            ))}
            {unfinishedFactors.map(factor => (
              <div key={factor.id} className="flex items-center justify-between gap-4 rounded-xl border border-warning/30 bg-warning/10 p-3">
                <div><p className="text-sm font-semibold text-text-primary">Unfinished authenticator setup</p><p className="text-xs text-text-secondary">Remove it before starting a new enrollment.</p></div>
                <Button type="button" variant="secondary" disabled={submitting} onClick={() => void removeFactor(factor.id, false)}>Remove</Button>
              </div>
            ))}
          </div>

          {!pending && <Button className="mt-5" onClick={() => void startEnrollment()} loading={submitting} disabled={unfinishedFactors.length > 0}>Add authenticator</Button>}

          {pending && (
            <form className="mt-6 border-t border-outline-subtle pt-6" onSubmit={verifyEnrollment}>
              <h3 className="font-bold text-text-primary">Scan and verify</h3>
              <p className="mt-1 text-sm text-text-secondary">Scan this QR code in your authenticator app. Then enter the generated six-digit code.</p>
              <img className="mt-4 h-48 w-48 rounded-xl bg-white p-2" src={qrCodeDataUrl(pending.qrCode)} alt="Authenticator enrollment QR code" />
              <details className="mt-3 text-sm text-text-secondary"><summary className="cursor-pointer font-semibold">Can’t scan the code?</summary><p className="mt-2">Enter this secret manually:</p><code className="mt-1 block break-all rounded-lg bg-surface-elevated p-2 text-text-primary">{pending.secret}</code></details>
              <div className="mt-5 max-w-xs"><Input id="enrollment-code" label="Six-digit code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></div>
              <div className="mt-4 flex flex-wrap gap-2"><Button type="submit" loading={submitting} disabled={code.length !== 6}>Verify authenticator</Button><Button type="button" variant="secondary" disabled={submitting} onClick={() => void cancelEnrollment()}>Cancel setup</Button></div>
            </form>
          )}

          {error && <p role="alert" className="mt-4 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
        </Card>
      </div>
    </main>
  )
}
