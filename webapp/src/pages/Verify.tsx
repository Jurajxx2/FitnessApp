import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { Button } from '../components/ui'

export default function Verify() {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const navigate = useNavigate()
  const [email] = useState(() => sessionStorage.getItem('otp-email') ?? '')

  useEffect(() => { if (!email) navigate('/login') }, [email, navigate])
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCooldown])

  function handleDigitChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    if (value.length > 1) {
      const pasted = value.slice(0, 6 - index)
      const next = [...digits]
      for (let i = 0; i < pasted.length; i++) next[index + i] = pasted[i]
      setDigits(next)
      inputs.current[Math.min(index + pasted.length, 5)]?.focus()
      return
    }
    const next = [...digits]; next[index] = value; setDigits(next)
    if (value && index < 5) inputs.current[index + 1]?.focus()
  }
  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus()
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const token = digits.join('')
    if (token.length < 6) return
    setError(''); setLoading(true)
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (verifyError) { setError(verifyError.message); return }
      if (!data.user) { setError('Overenie zlyhalo.'); return }
      sessionStorage.removeItem('otp-email')
      navigate('/nutrition', { replace: true })
    } catch (err) {
      logger.error('verify error', err)
      setError(err instanceof Error ? err.message : 'Neočakávaná chyba.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    if (error) { setError(error.message); return }
    setResendCooldown(60)
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-xs font-bold tracking-widest text-text-primary uppercase mb-8">Coach Foska</div>
        <h1 className="text-xl font-bold text-text-primary mb-2">Skontroluj email</h1>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          Poslali sme 6-miestny kód na <span className="text-text-primary">{email}</span>.
        </p>
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="flex gap-2 justify-center">
            {digits.map((d, i) => (
              <input key={i} ref={el => { inputs.current[i] = el }} type="text" inputMode="numeric" maxLength={1}
                value={d} onChange={e => handleDigitChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
                autoFocus={i === 0}
                className="w-11 h-12 text-center text-lg font-bold bg-surface-elevated border border-outline rounded-md text-text-primary outline-none focus:border-text-secondary" />
            ))}
          </div>
          {error && <p className="text-xs text-error text-center">{error}</p>}
          <Button type="submit" loading={loading} disabled={digits.join('').length < 6}>Overiť kód</Button>
        </form>
        <p className="text-xs text-text-secondary text-center mt-4">
          {resendCooldown > 0 ? `Poslať znova o ${resendCooldown}s`
            : <button onClick={handleResend} className="text-text-primary underline bg-transparent border-0 cursor-pointer">Poslať znova</button>}
        </p>
      </div>
    </div>
  )
}
