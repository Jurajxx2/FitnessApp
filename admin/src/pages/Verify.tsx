import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { athleteHomePath } from '../lib/access'
import { Button } from '../components/ui'
import { usePublicLocale } from '../i18n/PublicLocale'

export const copy = {
  en: {
    differentEmail: 'Use a different email',
    title: 'Check your email',
    introBefore: 'We sent a 6-digit code to',
    verify: 'Verify code',
    resendIn: 'Resend in',
    resend: 'Resend code',
    noUser: 'Verification failed: No user returned',
    genericError: 'An unexpected error occurred. Please try again.',
  },
  cs: {
    differentEmail: 'Použít jiný e-mail',
    title: 'Zkontrolujte e-mail',
    introBefore: 'Poslali jsme šestimístný kód na',
    verify: 'Ověřit kód',
    resendIn: 'Znovu poslat za',
    resend: 'Poslat kód znovu',
    noUser: 'Ověření se nezdařilo: účet nebyl nalezen',
    genericError: 'Došlo k neočekávané chybě. Zkuste to prosím znovu.',
  },
  sk: {
    differentEmail: 'Použiť iný e-mail',
    title: 'Skontroluj e-mail',
    introBefore: 'Poslali sme šesťmiestny kód na',
    verify: 'Overiť kód',
    resendIn: 'Znova odoslať za',
    resend: 'Odoslať kód znova',
    noUser: 'Overenie zlyhalo: účet nebol nájdený',
    genericError: 'Došlo k neočakávanej chybe. Skús to, prosím, znova.',
  },
} as const

export default function Verify() {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const navigate = useNavigate()
  const [email] = useState(() => sessionStorage.getItem('otp-email') ?? '')
  const { locale } = usePublicLocale()
  const t = copy[locale]

  useEffect(() => {
    if (!email) navigate('/login/otp')
  }, [email, navigate])

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCooldown])

  function handleDigitChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    // Handle paste: spread digits across boxes starting from current position
    if (value.length > 1) {
      const pasted = value.slice(0, 6 - index)
      const next = [...digits]
      for (let i = 0; i < pasted.length; i++) next[index + i] = pasted[i]
      setDigits(next)
      const nextFocus = Math.min(index + pasted.length, 5)
      inputs.current[nextFocus]?.focus()
      return
    }
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (value && index < 5) inputs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const token = digits.join('')
    if (token.length < 6) return
    setError('')
    setLoading(true)

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      })

      if (verifyError) {
        setError(verifyError.message)
        setLoading(false)
        return
      }

      if (!data.user) {
        setError(t.noUser)
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin, access_mode')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        logger.error('Error fetching profile during verification', profileError)
      }

      sessionStorage.removeItem('otp-email')
      navigate(profile?.is_admin ? '/admin' : athleteHomePath(profile), { replace: true })
    } catch (err) {
      logger.error('Unexpected verification error', err)
      setError(err instanceof Error ? err.message : t.genericError)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    const { error: resendError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    if (resendError) {
      setError(resendError.message)
      return
    }
    setResendCooldown(60)
  }

  return (
    <AuthLayout>
      <Link to="/login/otp" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary">
        <ArrowLeft size={16} /> {t.differentEmail}
      </Link>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary text-text-primary">
        <MailCheck size={22} />
      </div>
        <h1 className="mb-2 text-3xl font-display font-bold tracking-tight text-text-primary">{t.title}</h1>
        <p className="mb-8 text-sm leading-6 text-text-secondary">
          {t.introBefore} <span className="text-text-primary">{email}</span>.
        </p>
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="flex justify-between gap-2 sm:justify-start">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                autoFocus={i === 0}
                className="h-13 min-w-0 flex-1 rounded-xl border border-outline bg-surface text-center text-lg font-bold text-text-primary outline-none transition-colors focus:border-accent sm:w-12 sm:flex-none"
              />
            ))}
          </div>
          {error && <p className="text-center text-xs text-error">{error}</p>}
          <Button type="submit" loading={loading} disabled={digits.join('').length < 6} className="mt-2 min-h-12 w-full">
            {t.verify}
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-text-secondary">
          {resendCooldown > 0
            ? `${t.resendIn} ${resendCooldown}s`
            : <button onClick={handleResend} className="cursor-pointer border-0 bg-transparent text-text-primary underline">{t.resend}</button>}
        </p>
    </AuthLayout>
  )
}
