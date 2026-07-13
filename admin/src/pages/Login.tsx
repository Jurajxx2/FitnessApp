import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { athleteHomePath } from '../lib/access'
import { supabase } from '../lib/supabase'
import { usePublicLocale } from '../i18n/PublicLocale'

const copy = {
  en: {
    loading: 'Loading account…',
    back: 'Back to the website',
    eyebrow: 'Welcome back',
    title: 'Sign in to Coach Foska',
    intro: 'Enter your email and password to continue.',
    email: 'Email address',
    password: 'Password',
    passwordPlaceholder: 'Your password',
    forgot: 'Forgot password?',
    submit: 'Sign in',
    divider: 'or',
    otp: 'Login with a one-time code',
    invitation: 'Access is limited to invited Coach Foska accounts.',
    privacy: 'Privacy',
    terms: 'Terms',
    genericError: 'We could not sign you in. Please try again.',
  },
  cs: {
    loading: 'Načítám účet…',
    back: 'Zpět na web',
    eyebrow: 'Vítejte zpět',
    title: 'Přihlášení do Coach Foska',
    intro: 'Pro pokračování zadejte e-mail a heslo.',
    email: 'E-mailová adresa',
    password: 'Heslo',
    passwordPlaceholder: 'Vaše heslo',
    forgot: 'Zapomenuté heslo?',
    submit: 'Přihlásit se',
    divider: 'nebo',
    otp: 'Přihlásit se jednorázovým kódem',
    invitation: 'Přístup je omezený na pozvané účty Coach Foska.',
    privacy: 'Ochrana soukromí',
    terms: 'Podmínky',
    genericError: 'Přihlášení se nezdařilo. Zkuste to prosím znovu.',
  },
} as const

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { session, profile, isAdmin, isLoading: authLoading } = useAuth()
  const { locale } = usePublicLocale()
  const t = copy[locale]

  useEffect(() => {
    if (!authLoading && session) navigate(isAdmin ? '/admin' : athleteHomePath(profile), { replace: true })
  }, [authLoading, isAdmin, navigate, profile, session])

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
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary">
        <ArrowLeft size={16} aria-hidden="true" /> {t.back}
      </Link>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary text-text-primary">
        <KeyRound size={22} />
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">{t.eyebrow}</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-text-primary">{t.title}</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        {t.intro}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <Input
          id="email"
          name="email"
          type="email"
          label={t.email}
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
          label={t.password}
          placeholder={t.passwordPlaceholder}
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
          {t.forgot}
        </Link>
        {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
        <Button type="submit" loading={loading} disabled={!email.trim() || !password} className="min-h-12 w-full">
          {t.submit} <ArrowRight size={17} />
        </Button>
      </form>

      <div className="my-7 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-outline-subtle" />
        <span className="text-xs font-medium text-text-secondary">{t.divider}</span>
        <span className="h-px flex-1 bg-outline-subtle" />
      </div>
      <Link
        to="/login/otp"
        className="flex min-h-12 w-full items-center justify-center rounded-xl border border-outline bg-surface px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
      >
        {t.otp}
      </Link>
      <p className="mt-6 text-center text-xs leading-5 text-text-secondary">
        {t.invitation}
      </p>
      <div className="mt-4 flex justify-center gap-5 text-xs font-medium text-text-secondary">
        <Link to="/privacy" className="hover:text-text-primary">{t.privacy}</Link>
        <Link to="/terms" className="hover:text-text-primary">{t.terms}</Link>
      </div>
    </AuthLayout>
  )
}
