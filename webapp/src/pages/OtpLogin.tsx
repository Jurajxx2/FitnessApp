import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { supabase } from '../lib/supabase'

export default function OtpLogin() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    setError('')
    setLoading(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email: cleanEmail, options: { shouldCreateUser: false } })
      if (otpError) { setError(otpError.message); return }
      sessionStorage.setItem('otp-email', cleanEmail)
      navigate('/login/verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kód sa nepodarilo odoslať.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Link to="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary"><ArrowLeft size={16} /> Späť na prihlásenie</Link>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary"><Mail size={22} /></div>
      <h1 className="text-3xl font-extrabold tracking-[-0.035em]">Prihlásenie kódom</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">Zadaj email priradený k účtu Coach Foska. Pošleme ti šesťmiestny kód.</p>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <Input id="otp-email" name="email" type="email" label="Email" placeholder="ty@email.sk" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required autoFocus />
        {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
        <Button type="submit" loading={loading} disabled={!email.trim()} className="w-full">Poslať prihlasovací kód</Button>
      </form>
    </AuthLayout>
  )
}
