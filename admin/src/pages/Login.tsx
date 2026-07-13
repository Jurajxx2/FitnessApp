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
  const { session, isAdmin, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && session) navigate(isAdmin ? '/admin' : '/nutrition', { replace: true })
  }, [authLoading, isAdmin, navigate, session])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInError) setError(signInError.message)
      // Successful navigation is driven by the resolved AuthProvider state so
      // both password and restored sessions use exactly the same role decision.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not sign you in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">Loading account…</div>
  }

  return (
    <AuthLayout>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary text-text-primary">
        <KeyRound size={22} />
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Welcome back</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-text-primary">Sign in to Coach Foska</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        Enter your email and password to continue.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChange={event => setEmail(event.target.value)}
          autoComplete="email"
          required
          autoFocus
          className="h-12"
        />
        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="Your password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="h-12"
        />
        <Link
          to="/login/forgot-password"
          className="-mt-3 self-end text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
        >
          Forgot password?
        </Link>
        {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
        <Button type="submit" loading={loading} disabled={!email.trim() || !password} className="min-h-12 w-full">
          Sign in <ArrowRight size={17} />
        </Button>
      </form>

      <div className="my-7 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-outline-subtle" />
        <span className="text-xs font-medium text-text-secondary">or</span>
        <span className="h-px flex-1 bg-outline-subtle" />
      </div>
      <Link
        to="/login/otp"
        className="flex min-h-12 w-full items-center justify-center rounded-xl border border-outline bg-surface px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
      >
        Login with a one-time code
      </Link>
      <p className="mt-6 text-center text-xs leading-5 text-text-secondary">
        Access is limited to invited Coach Foska accounts.
      </p>
    </AuthLayout>
  )
}
