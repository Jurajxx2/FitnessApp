import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: window.location.origin },
      )
      if (resetError) {
        setError(resetError.message)
        return
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odkaz sa nepodarilo odoslať. Skús to znova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary text-text-primary"><Mail size={22} /></div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Obnova účtu</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-text-primary">Obnoviť heslo</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        {sent
          ? 'Ak pre tento email existuje účet, poslali sme naň odkaz na obnovu hesla.'
          : 'Zadaj svoj email a pošleme ti bezpečný odkaz na vytvorenie nového hesla.'}
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-success/30 bg-success/10 p-5">
          <p role="status" className="text-sm leading-6 text-text-primary">Skontroluj si doručenú poštu a otvor odkaz v emaile. Túto stránku môžeš zavrieť.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <Input id="recovery-email" name="email" type="email" label="Email" placeholder="ty@email.sk" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required autoFocus />
          {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
          <Button type="submit" loading={loading} disabled={!email.trim()} className="w-full">Poslať odkaz</Button>
        </form>
      )}

      <Link to="/login" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary">
        <ArrowLeft size={16} /> Späť na prihlásenie
      </Link>
    </AuthLayout>
  )
}
