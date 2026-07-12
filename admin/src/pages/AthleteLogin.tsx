import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Input, Button } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingAction, setLoadingAction] = useState<'password' | 'otp' | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { session, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && session) navigate('/nutrition', { replace: true })
  }, [authLoading, session, navigate])

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoadingAction('password')
    const clean = email.trim().toLowerCase()
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: clean, password })
      if (signInError) { setError(signInError.message); return }
      navigate('/nutrition', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neočakávaná chyba.')
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleOtpLogin(e: React.MouseEvent<HTMLButtonElement>) {
    const emailInput = e.currentTarget.form?.elements.namedItem('email')
    if (emailInput instanceof HTMLInputElement && !emailInput.reportValidity()) return

    setError('')
    setLoadingAction('otp')
    const clean = email.trim().toLowerCase()
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { shouldCreateUser: false },
      })
      if (otpError) { setError(otpError.message); return }
      sessionStorage.setItem('otp-email', clean)
      navigate('/verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neočakávaná chyba.')
    } finally {
      setLoadingAction(null)
    }
  }

  if (authLoading) {
    return <div className="min-h-dvh bg-background flex items-center justify-center">
      <p className="text-text-secondary text-sm">Loading…</p>
    </div>
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-xs font-bold tracking-widest text-text-primary uppercase mb-8">Coach Foska</div>
        <h1 className="ds-display-lg text-text-primary mb-2">Ahoj 👋</h1>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          Prihlás sa emailom a heslom. Ak heslo nemáš, použi jednorazový kód.
        </p>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
          <Input id="email" name="email" type="email" label="Email" placeholder="ty@email.sk"
                 value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          <Input id="password" type="password" label="Heslo" placeholder="Tvoje heslo"
                 value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          {error && <p role="alert" className="text-xs text-error">{error}</p>}
          <Button type="submit" loading={loadingAction === 'password'}
                  disabled={!email.trim() || !password || loadingAction !== null}>
            Prihlásiť sa →
          </Button>
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-outline" />
            <span className="text-xs text-text-secondary">alebo</span>
            <span className="h-px flex-1 bg-outline" />
          </div>
          <Button type="button" variant="secondary" onClick={handleOtpLogin}
                  loading={loadingAction === 'otp'} disabled={!email.trim() || loadingAction !== null}>
            Prihlásiť sa jednorazovým kódom
          </Button>
        </form>
      </div>
    </div>
  )
}
