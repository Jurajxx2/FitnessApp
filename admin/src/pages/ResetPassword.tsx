import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(false)
  const { session, isLoading: authLoading } = useAuth()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setUpdated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not update your password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">Checking reset link…</div>
  }

  return (
    <AuthLayout>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary text-text-primary">
        <KeyRound size={22} />
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Account recovery</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-text-primary">
        {updated ? 'Password updated' : 'Choose a new password'}
      </h1>

      {updated ? (
        <div className="mt-6">
          <p role="status" className="text-sm leading-6 text-text-secondary">Your new password is ready to use.</p>
          <Link to="/login" className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-action-primary px-4 text-sm font-semibold text-on-action-primary transition-opacity hover:opacity-85">
            Continue to Coach Foska
          </Link>
        </div>
      ) : !session ? (
        <div className="mt-6">
          <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-3 text-sm leading-6 text-error">
            This password reset link is invalid or has expired.
          </p>
          <Link to="/login/forgot-password" className="mt-7 inline-flex text-sm font-semibold text-text-primary hover:text-accent">
            Request a new reset link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <Input
            id="new-password"
            name="new-password"
            type="password"
            label="New password"
            placeholder="At least 8 characters"
            value={password}
            onChange={event => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            autoFocus
            className="h-12"
          />
          <Input
            id="confirm-password"
            name="confirm-password"
            type="password"
            label="Confirm new password"
            placeholder="Repeat your new password"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="h-12"
          />
          {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
          <Button type="submit" loading={loading} disabled={!password || !confirmation} className="min-h-12 w-full">
            Save new password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
