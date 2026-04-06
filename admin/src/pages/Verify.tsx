import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

export default function Verify() {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const navigate = useNavigate()
  const email = sessionStorage.getItem('otp-email') ?? ''

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
    const next = [...digits]
    next[index] = value.slice(-1)
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
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', data.user!.id).single()
    sessionStorage.removeItem('otp-email')
    navigate(profile?.is_admin ? '/admin' : '/403', { replace: true })
  }

  async function handleResend() {
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setResendCooldown(60)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-xs font-bold tracking-widest text-white uppercase mb-8">Coach Foska</div>
        <h1 className="text-xl font-bold text-white mb-2">Check your email</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
          We sent a 6-digit code to <span className="text-[var(--text)]">{email}</span>.
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
                className="w-11 h-12 text-center text-lg font-bold bg-[var(--input-bg)] border border-[var(--border)] rounded-md text-[var(--text)] outline-none focus:border-[var(--text-muted)]"
              />
            ))}
          </div>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          <Button type="submit" loading={loading} disabled={digits.join('').length < 6}>
            Verify code
          </Button>
        </form>
        <p className="text-xs text-[var(--text-muted)] text-center mt-4">
          {resendCooldown > 0
            ? `Resend in ${resendCooldown}s`
            : <button onClick={handleResend} className="text-[var(--text)] underline cursor-pointer bg-transparent border-0">Resend code</button>}
        </p>
      </div>
    </div>
  )
}
