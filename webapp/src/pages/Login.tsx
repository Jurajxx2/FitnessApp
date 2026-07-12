import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Input, Button } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { session, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && session) navigate('/nutrition', { replace: true })
  }, [authLoading, session, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const clean = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: false } })
    setLoading(false)
    if (error) { setError(error.message); return }
    sessionStorage.setItem('otp-email', clean)
    navigate('/verify')
  }

  if (authLoading) {
    return <div className="min-h-dvh bg-background flex items-center justify-center">
      <p className="text-text-secondary text-sm">Loading…</p>
    </div>
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-xs font-bold tracking-widest text-text-primary uppercase mb-8">Coach Foska</div>
        <h1 className="ds-display-lg text-text-primary mb-2">Ahoj 👋</h1>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          Zadaj svoj email a pošleme ti jednorazový kód na prihlásenie.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input id="email" type="email" label="Email" placeholder="ty@email.sk"
                 value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          {error && <p className="text-xs text-error">{error}</p>}
          <Button type="submit" loading={loading} disabled={!email}>Poslať kód →</Button>
        </form>
      </div>
    </div>
  )
}
