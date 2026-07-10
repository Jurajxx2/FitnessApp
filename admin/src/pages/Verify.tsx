import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { Button, Card } from '../components/ui'

export default function Verify() {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const navigate = useNavigate()
  const [email] = useState(() => sessionStorage.getItem('otp-email') ?? '')

  useEffect(() => {
    if (!email) navigate('/auth')
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
        setError('Verification failed: No user returned')
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        logger.error('Error fetching profile during verification', profileError)
      }

      sessionStorage.removeItem('otp-email')
      navigate(profile?.is_admin ? '/admin' : '/403', { replace: true })
    } catch (err) {
      logger.error('Unexpected verification error', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setResendCooldown(60)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 sm:p-7">
        <div className="mb-8 text-xs font-bold uppercase tracking-widest text-text-primary">Coach Foska</div>
        <h1 className="mb-2 text-xl font-bold text-text-primary">Check your email</h1>
        <p className="mb-6 text-sm leading-relaxed text-text-secondary">
          We sent a 6-digit code to <span className="text-text-primary">{email}</span>.
        </p>
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="flex gap-2 justify-center">
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
                className="h-12 w-11 rounded-xl border border-outline bg-surface text-center text-lg font-bold text-text-primary outline-none focus:border-accent"
              />
            ))}
          </div>
          {error && <p className="text-center text-xs text-error">{error}</p>}
          <Button type="submit" loading={loading} disabled={digits.join('').length < 6}>
            Verify code
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-text-secondary">
          {resendCooldown > 0
            ? `Resend in ${resendCooldown}s`
            : <button onClick={handleResend} className="cursor-pointer border-0 bg-transparent text-text-primary underline">Resend code</button>}
        </p>
      </Card>
    </div>
  )
}
