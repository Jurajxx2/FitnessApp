import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { supabase } from '../lib/supabase'
import { usePublicLocale } from '../i18n/PublicLocale'

const copy = {
  en: {
    back: 'Back to password login',
    title: 'Login with a one-time code',
    intro: 'Enter the email connected to your Coach Foska account. We will send you a six-digit code.',
    email: 'Email address',
    submit: 'Send login code',
    genericError: 'We could not send the code. Please try again.',
  },
  cs: {
    back: 'Zpět k přihlášení heslem',
    title: 'Přihlášení jednorázovým kódem',
    intro: 'Zadejte e-mail propojený s vaším účtem Coach Foska. Pošleme vám šestimístný kód.',
    email: 'E-mailová adresa',
    submit: 'Poslat přihlašovací kód',
    genericError: 'Kód se nepodařilo odeslat. Zkuste to prosím znovu.',
  },
} as const

export default function OtpLogin() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { locale } = usePublicLocale()
  const t = copy[locale]

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    setError('')
    setLoading(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false },
      })
      if (otpError) {
        setError(otpError.message)
        return
      }
      sessionStorage.setItem('otp-email', cleanEmail)
      navigate('/login/verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Link to="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary">
        <ArrowLeft size={16} /> {t.back}
      </Link>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary text-text-primary">
        <Mail size={22} />
      </div>
      <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-text-primary">{t.title}</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        {t.intro}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <Input
          id="otp-email"
          name="email"
          type="email"
          label={t.email}
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          required
          autoFocus
          className="h-12"
        />
        {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
        <Button type="submit" loading={loading} disabled={!email.trim()} className="min-h-12 w-full">
          {t.submit}
        </Button>
      </form>
    </AuthLayout>
  )
}
