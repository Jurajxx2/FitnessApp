import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { useAuthAssurance } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

interface MfaFactor {
  id: string
  friendly_name?: string
  factor_type: string
  status: 'verified' | 'unverified'
  created_at: string
}

interface TotpEnrollment {
  id: string
  qrCode: string
  secret: string
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The security request failed. Please try again.'
}

function qrCodeSource(value: string): string {
  return value.startsWith('data:') ? value : `data:image/svg+xml;utf-8,${encodeURIComponent(value)}`
}

export default function AdminMfa() {
  const navigate = useNavigate()
  const assurance = useAuthAssurance()
  const [factors, setFactors] = useState<MfaFactor[]>([])
  const [selectedFactorId, setSelectedFactorId] = useState('')
  const [deviceName, setDeviceName] = useState('Coach Foska authenticator')
  const [code, setCode] = useState('')
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [loadingFactors, setLoadingFactors] = useState(true)
  const [factorListError, setFactorListError] = useState('')
  const [pendingAction, setPendingAction] = useState<'enroll' | 'verify' | string | null>(null)
  const [error, setError] = useState('')

  const verifiedFactors = useMemo(
    () => factors.filter(factor => factor.factor_type === 'totp' && factor.status === 'verified'),
    [factors],
  )
  const unverifiedFactors = useMemo(
    () => factors.filter(factor => factor.factor_type === 'totp' && factor.status === 'unverified'),
    [factors],
  )

  const loadFactors = useCallback(async () => {
    setLoadingFactors(true)
    setFactorListError('')
    setError('')
    try {
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      const nextFactors = data.all as MfaFactor[]
      setFactors(nextFactors)
      const firstVerified = nextFactors.find(factor => factor.factor_type === 'totp' && factor.status === 'verified')
      setSelectedFactorId(current => (
        nextFactors.some(factor => factor.id === current && factor.status === 'verified')
          ? current
          : firstVerified?.id ?? ''
      ))
    } catch (loadError) {
      setFactorListError(messageFrom(loadError))
    } finally {
      setLoadingFactors(false)
    }
  }, [])

  useEffect(() => {
    void loadFactors()
  }, [loadFactors])

  async function beginEnrollment() {
    setPendingAction('enroll')
    setError('')
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: deviceName.trim() || 'Coach Foska authenticator',
      })
      if (enrollError) throw enrollError
      setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
      setCode('')
      await loadFactors()
    } catch (enrollError) {
      setError(messageFrom(enrollError))
    } finally {
      setPendingAction(null)
    }
  }

  async function verifyFactor(factorId: string) {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }

    setPendingAction('verify')
    setError('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      })
      if (verifyError) throw verifyError

      setEnrollment(null)
      setCode('')
      await loadFactors()
      const nextAssurance = await assurance.refreshAssuranceLevel()
      if (nextAssurance.currentLevel !== 'aal2' || nextAssurance.error) {
        throw new Error('The code was accepted, but the secured session could not be confirmed. Try again.')
      }
      navigate('/admin', { replace: true })
    } catch (verifyError) {
      setError(messageFrom(verifyError))
    } finally {
      setPendingAction(null)
    }
  }

  async function removeFactor(factor: MfaFactor) {
    if (factor.status === 'verified') {
      setError('Verified authenticators can only be removed through the protected operator recovery procedure.')
      return
    }
    setPendingAction(factor.id)
    setError('')
    try {
      // Re-read immediately before mutation so another tab completing this
      // enrollment cannot turn a stale incomplete row into browser-managed
      // verified-factor deletion.
      const { data: latestFactors, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) {
        setFactorListError(messageFrom(listError))
        throw listError
      }
      const latestFactor = (latestFactors.all as MfaFactor[]).find(candidate => candidate.id === factor.id)
      if (!latestFactor) throw new Error('This incomplete setup no longer exists. Refresh and try again.')
      if (latestFactor.factor_type !== 'totp' || latestFactor.status !== 'unverified') {
        throw new Error('Verified authenticators can only be removed through the protected operator recovery procedure.')
      }
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (unenrollError) throw unenrollError
      if (enrollment?.id === factor.id) setEnrollment(null)
      await loadFactors()
    } catch (unenrollError) {
      setError(messageFrom(unenrollError))
    } finally {
      setPendingAction(null)
    }
  }

  if (assurance.isLoading) {
    return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">Checking sign-in security…</div>
  }

  if (assurance.error) {
    return (
      <AuthLayout>
        <p className="ledger-label text-text-secondary">Admin security</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-text-primary">Security check unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">We could not confirm the security level of this session. Admin content stays locked until the check succeeds.</p>
        <p role="alert" className="mt-5 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{assurance.error.message}</p>
        <Button className="mt-5 w-full" onClick={() => void assurance.refreshAssuranceLevel()}>Try again</Button>
      </AuthLayout>
    )
  }

  const isAal2 = assurance.currentLevel === 'aal2'
  const verificationFactorId = enrollment?.id ?? selectedFactorId

  return (
    <AuthLayout>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-subtle bg-action-secondary text-accent-strong">
        {isAal2 ? <ShieldCheck size={23} aria-hidden="true" /> : <KeyRound size={23} aria-hidden="true" />}
      </div>
      <p className="ledger-label text-text-secondary">Admin security</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text-primary">
        {isAal2 ? 'Manage authenticators' : 'Two-step verification required'}
      </h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        {isAal2
          ? 'Keep at least one verified authenticator connected to your admin account.'
          : 'Admin access requires a fresh code from an authenticator app.'}
      </p>

      {error && <p role="alert" className="mt-5 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}

      {loadingFactors ? (
        <p role="status" className="mt-6 text-sm text-text-secondary">Loading authenticators…</p>
      ) : factorListError ? (
        <section className="mt-6 rounded-2xl border border-error/30 bg-error/10 p-5">
          <h2 className="font-display text-lg font-bold text-text-primary">Authenticators unavailable</h2>
          <p role="alert" className="mt-2 text-sm leading-6 text-error">{factorListError}</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Enrollment, verification, and factor removal stay unavailable until the factor list loads successfully.</p>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => void loadFactors()}>Retry factor list</Button>
        </section>
      ) : enrollment ? (
        <section className="mt-6 rounded-2xl border border-outline-subtle bg-surface p-5">
          <h2 className="font-display text-lg font-bold text-text-primary">Scan this code</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Scan the QR code in your authenticator app, then enter the generated 6-digit code.</p>
          <img src={qrCodeSource(enrollment.qrCode)} alt="Authenticator enrollment QR code" className="mx-auto my-5 h-48 w-48 rounded-xl bg-white p-2" />
          <details className="mb-5 rounded-xl border border-outline-subtle bg-background p-3 text-sm text-text-secondary">
            <summary className="cursor-pointer font-semibold text-text-primary">Enter a setup key instead</summary>
            <code className="mt-3 block break-all select-all font-mono text-xs text-text-primary">{enrollment.secret}</code>
          </details>
          <Input
            label="6-digit code"
            value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
          <Button className="mt-4 w-full" loading={pendingAction === 'verify'} onClick={() => void verifyFactor(enrollment.id)}>
            Verify and enable
          </Button>
        </section>
      ) : !isAal2 && verifiedFactors.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-outline-subtle bg-surface p-5">
          {verifiedFactors.length > 1 && (
            <label className="mb-4 block text-sm font-semibold text-text-primary">
              Authenticator
              <select
                aria-label="Authenticator"
                value={selectedFactorId}
                onChange={event => setSelectedFactorId(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-outline bg-background px-3 text-sm text-text-primary"
              >
                {verifiedFactors.map(factor => <option key={factor.id} value={factor.id}>{factor.friendly_name || 'Authenticator app'}</option>)}
              </select>
            </label>
          )}
          <Input
            label="6-digit code"
            value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
          <Button className="mt-4 w-full" loading={pendingAction === 'verify'} disabled={!verificationFactorId} onClick={() => void verifyFactor(verificationFactorId)}>
            Verify and continue
          </Button>
          <Link to="/admin/mfa/recovery" className="mt-4 block text-center text-sm font-semibold text-text-secondary underline hover:text-text-primary">Lost access to your authenticator?</Link>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-outline-subtle bg-surface p-5">
          {!isAal2 && <p className="mb-4 text-sm leading-6 text-text-secondary">Connect an authenticator app before continuing to the admin workspace.</p>}
          <Input label="Device name" value={deviceName} onChange={event => setDeviceName(event.target.value)} maxLength={64} />
          <Button className="mt-4 w-full" loading={pendingAction === 'enroll'} onClick={() => void beginEnrollment()}>
            <Plus size={17} aria-hidden="true" /> Add authenticator
          </Button>
        </section>
      )}

      {!loadingFactors && !factorListError && (isAal2 || unverifiedFactors.length > 0) && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-bold text-text-primary">Connected factors</h2>
          <div className="mt-3 flex flex-col gap-2">
            {factors.filter(factor => factor.factor_type === 'totp').map(factor => {
              const isVerified = factor.status === 'verified'
              return (
                <div key={factor.id} className="flex items-center justify-between gap-3 rounded-xl border border-outline-subtle bg-surface p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{factor.friendly_name || 'Authenticator app'}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">{factor.status === 'verified' ? 'Verified' : 'Setup incomplete'}</p>
                  </div>
                  <Button
                    variant="ghost"
                    aria-label={`Remove ${factor.friendly_name || 'authenticator app'}`}
                    disabled={isVerified}
                    title={isVerified ? 'Verified authenticators require the protected operator recovery procedure.' : undefined}
                    loading={pendingAction === factor.id}
                    onClick={() => void removeFactor(factor)}
                  >
                    <Trash2 size={16} aria-hidden="true" /> Remove
                  </Button>
                </div>
              )
            })}
          </div>
          {verifiedFactors.length > 0 && (
            <p className="mt-2 text-xs leading-5 text-text-secondary">
              Verified authenticators cannot be removed in the browser. <Link to="/admin/mfa/recovery" className="font-semibold underline hover:text-text-primary">Open the protected recovery instructions</Link> if a device is lost or must be replaced.
            </p>
          )}
        </section>
      )}

      {isAal2 && (
        <Button variant="secondary" className="mt-6 w-full" onClick={() => navigate('/admin', { replace: true })}>
          Return to admin
        </Button>
      )}
    </AuthLayout>
  )
}
