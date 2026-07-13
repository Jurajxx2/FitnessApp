import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: window.location.origin },
      )
      if (resetError) {
        setError(resetError.message)
        return
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send the reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary text-text-primary">
        <Mail size={22} />
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Account recovery</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-text-primary">Reset your password</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        {sent
          ? 'If an account exists for that email, a password reset link is on its way.'
          : 'Enter your email and we will send you a secure link to choose a new password.'}
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-success/30 bg-success/10 p-5">
          <p role="status" className="text-sm leading-6 text-text-primary">Check your inbox and follow the link in the email. You can close this page safely.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <Input
            id="recovery-email"
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
          {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
          <Button type="submit" loading={loading} disabled={!email.trim()} className="min-h-12 w-full">
            Send reset link
          </Button>
        </form>
      )}

      <Link to="/login" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary">
        <ArrowLeft size={16} /> Back to sign in
      </Link>
    </AuthLayout>
  )
}
