import { useEffect, useState } from 'react'
import { ArrowRight, KeyRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { session, isLoading: authLoading } = useAuth()

  useEffect(() => { if (!authLoading && session) navigate('/nutrition', { replace: true }) }, [authLoading, navigate, session])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (signInError) { setError(signInError.message); return }
      navigate('/nutrition', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prihlásenie sa nepodarilo.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">Načítavam účet…</div>

  return (
    <AuthLayout>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary"><KeyRound size={22} /></div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Vitaj späť</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.035em]">Prihlás sa do Coach Foska</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">Použi email a heslo priradené k svojmu účtu.</p>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <Input id="email" name="email" type="email" label="Email" placeholder="ty@email.sk" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required autoFocus />
        <Input id="password" name="password" type="password" label="Heslo" placeholder="Tvoje heslo" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />
        <Link to="/login/forgot-password" className="-mt-3 self-end text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary">Zabudol si heslo?</Link>
        {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
        <Button type="submit" loading={loading} disabled={!email.trim() || !password} className="w-full">Prihlásiť sa <ArrowRight size={17} /></Button>
      </form>
      <div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-outline-subtle" /><span className="text-xs text-text-secondary">alebo</span><span className="h-px flex-1 bg-outline-subtle" /></div>
      <Link to="/login/otp" className="flex h-12 w-full items-center justify-center rounded-xl border border-outline bg-surface text-sm font-semibold text-text-primary hover:bg-surface-elevated">Prihlásiť sa jednorazovým kódom</Link>
    </AuthLayout>
  )
}
