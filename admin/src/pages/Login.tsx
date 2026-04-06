import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Input, Button } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      sessionStorage.setItem('otp-email', email.trim().toLowerCase())
      navigate('/auth/verify')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-xs font-bold tracking-widest text-white uppercase mb-8">Coach Foska</div>
        <h1 className="text-xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
          Enter your email to receive a one-time login code. Admin access is required.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button type="submit" loading={loading} disabled={!email}>
            Send login code →
          </Button>
        </form>
      </div>
    </div>
  )
}
