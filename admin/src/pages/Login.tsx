import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { useAuth, useAuthAssurance } from '../hooks/useAuth'
import { postAuthDestination } from '../lib/authDestination'
import { friendlyAuthError, isCompromisedPasswordWarning } from '../lib/authErrors'
import { supabase } from '../lib/supabase'
import { usePublicLocale } from '../i18n/PublicLocale'

export const copy = {
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
    compromisedPassword: 'This password has appeared in a known data breach. Reset it to a new, unique password before continuing.',
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
    compromisedPassword: 'Toto heslo se objevilo ve známém úniku dat. Než budete pokračovat, obnovte ho na nové a jedinečné heslo.',
  },
  sk: {
    loading: 'Načítavam účet…',
    back: 'Späť na web',
    eyebrow: 'Vitaj späť',
    title: 'Prihlásenie do Coach Foska',
    intro: 'Pre pokračovanie zadaj e-mail a heslo.',
    email: 'E-mailová adresa',
    password: 'Heslo',
    passwordPlaceholder: 'Tvoje heslo',
    forgot: 'Zabudnuté heslo?',
    submit: 'Prihlásiť sa',
    divider: 'alebo',
    otp: 'Prihlásiť sa jednorazovým kódom',
    invitation: 'Prístup je obmedzený na pozvané účty Coach Foska.',
    privacy: 'Ochrana súkromia',
    terms: 'Podmienky',
    genericError: 'Prihlásenie sa nepodarilo. Skús to, prosím, znova.',
    compromisedPassword: 'Toto heslo sa objavilo v známom úniku dát. Pred pokračovaním ho obnov na nové a jedinečné heslo.',
  },
} as const

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suppressSessionNavigation, setSuppressSessionNavigation] = useState(false)
  const navigate = useNavigate()
  const { session, profile, isLoading: authLoading } = useAuth()
  const assurance = useAuthAssurance()
  const { locale } = usePublicLocale()
  const t = copy[locale]

  useEffect(() => {
    if (!loading && !suppressSessionNavigation && !authLoading && !assurance.isLoading && session) {
      navigate(postAuthDestination(profile, {
        currentLevel: assurance.currentLevel,
        error: assurance.error,
      }), { replace: true })
    }
  }, [assurance.currentLevel, assurance.error, assurance.isLoading, authLoading, loading, navigate, profile, session, suppressSessionNavigation])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInError) {
        setError(friendlyAuthError(signInError, t.compromisedPassword, t.genericError))
      } else if (isCompromisedPasswordWarning(data.weakPassword)) {
        // Supabase can return a valid session plus a weak-password warning for
        // an existing account. Do not let that session navigate past this
        // screen when the warning specifically identifies a leaked password.
        setSuppressSessionNavigation(true)
        try {
          // Clear the browser session before any network request. auth-js emits
          // SIGNED_IN before signInWithPassword resolves, so a global sign-out
          // first would leave a navigation race while its request is pending.
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
          // Navigation stays suppressed even if local storage is unavailable.
        }
        if (data.session?.access_token) {
          try {
            await supabase.auth.admin.signOut(data.session.access_token, 'global')
          } catch {
            // The local session is already cleared and navigation remains
            // suppressed even if refresh-token revocation is unavailable.
          }
        }
        setError(t.compromisedPassword)
      } else {
        setSuppressSessionNavigation(false)
      }
      // Successful navigation is driven by the resolved AuthProvider state so
      // both password and restored sessions use exactly the same role decision.
    } catch (err) {
      setError(friendlyAuthError(err, t.compromisedPassword, t.genericError))
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || assurance.isLoading) {
    return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">{t.loading}</div>
  }

  return (
    <AuthLayout>
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary">
        <ArrowLeft size={16} aria-hidden="true" /> {t.back}
      </Link>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-subtle bg-action-secondary text-accent-strong">
        <KeyRound size={22} />
      </div>
      <p className="mb-2 flex items-center gap-2 ledger-label text-text-secondary">
        <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
        {t.eyebrow}
      </p>
      <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary">{t.title}</h1>
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
