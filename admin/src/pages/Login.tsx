import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Input, Button } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { session, isAdmin, isLoading: authLoading } = useAuth()

  // Redirect already-authenticated users so they don't see the login form.
  useEffect(() => {
    if (authLoading) return
    if (session) {
      navigate(isAdmin ? '/admin' : '/403', { replace: true })
    }
  }, [authLoading, session, isAdmin, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      sessionStorage.setItem('otp-email', email.trim().toLowerCase())
      navigate('/auth/verify')
    }
  }

  // Don't flash the login form while we're resolving the existing session.
  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 sm:p-7">
        <div className="mb-8 text-xs font-bold uppercase tracking-widest text-text-primary">Coach Foska</div>
        <h1 className="mb-2 text-xl font-bold text-text-primary">Sign in</h1>
        <p className="mb-6 text-sm leading-relaxed text-text-secondary">
          Enter your email to receive a one-time login code.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="text-xs text-error">{error}</p>}
          <Button type="submit" loading={loading} disabled={!email}>
            Send login code →
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-text-secondary">
          Training with Coach Foska?{' '}
          <Link className="font-semibold text-text-primary underline" to="/login">
            Open athlete login
          </Link>
        </p>
      </Card>
    </div>
  )
}
