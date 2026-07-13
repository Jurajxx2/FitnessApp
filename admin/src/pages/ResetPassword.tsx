import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { usePublicLocale } from '../i18n/PublicLocale'

const copy = {
  en: {
    loading: 'Checking reset link…',
    eyebrow: 'Account recovery',
    updatedTitle: 'Password updated',
    title: 'Choose a new password',
    updatedStatus: 'Your new password is ready to use.',
    continue: 'Continue to Coach Foska',
    invalid: 'This password reset link is invalid or has expired.',
    newLink: 'Request a new reset link',
    password: 'New password',
    passwordPlaceholder: 'At least 8 characters',
    confirmation: 'Confirm new password',
    confirmationPlaceholder: 'Repeat your new password',
    submit: 'Save new password',
    tooShort: 'Use at least 8 characters for your new password.',
    mismatch: 'The passwords do not match.',
    genericError: 'We could not update your password. Please try again.',
  },
  cs: {
    loading: 'Kontroluji odkaz pro obnovení…',
    eyebrow: 'Obnovení účtu',
    updatedTitle: 'Heslo bylo změněno',
    title: 'Zvolte nové heslo',
    updatedStatus: 'Nové heslo je připravené k použití.',
    continue: 'Pokračovat do Coach Foska',
    invalid: 'Odkaz pro obnovení hesla je neplatný nebo vypršel.',
    newLink: 'Požádat o nový odkaz',
    password: 'Nové heslo',
    passwordPlaceholder: 'Alespoň 8 znaků',
    confirmation: 'Potvrzení nového hesla',
    confirmationPlaceholder: 'Zopakujte nové heslo',
    submit: 'Uložit nové heslo',
    tooShort: 'Nové heslo musí mít alespoň 8 znaků.',
    mismatch: 'Hesla se neshodují.',
    genericError: 'Heslo se nepodařilo změnit. Zkuste to prosím znovu.',
  },
} as const

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(false)
  const { session, isLoading: authLoading } = useAuth()
  const { locale } = usePublicLocale()
  const t = copy[locale]

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError(t.tooShort)
      return
    }
    if (password !== confirmation) {
      setError(t.mismatch)
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
      setError(err instanceof Error ? err.message : t.genericError)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">{t.loading}</div>
  }

  return (
    <AuthLayout>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary text-text-primary">
        <KeyRound size={22} />
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">{t.eyebrow}</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-text-primary">
        {updated ? t.updatedTitle : t.title}
      </h1>

      {updated ? (
        <div className="mt-6">
          <p role="status" className="text-sm leading-6 text-text-secondary">{t.updatedStatus}</p>
          <Link to="/login" className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-action-primary px-4 text-sm font-semibold text-on-action-primary transition-opacity hover:opacity-85">
            {t.continue}
          </Link>
        </div>
      ) : !session ? (
        <div className="mt-6">
          <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-3 text-sm leading-6 text-error">
            {t.invalid}
          </p>
          <Link to="/login/forgot-password" className="mt-7 inline-flex text-sm font-semibold text-text-primary hover:text-accent">
            {t.newLink}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <Input
            id="new-password"
            name="new-password"
            type="password"
            label={t.password}
            placeholder={t.passwordPlaceholder}
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
            label={t.confirmation}
            placeholder={t.confirmationPlaceholder}
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="h-12"
          />
          {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
          <Button type="submit" loading={loading} disabled={!password || !confirmation} className="min-h-12 w-full">
            {t.submit}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
