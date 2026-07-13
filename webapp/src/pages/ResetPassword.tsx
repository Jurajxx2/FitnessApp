import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(false)
  const { session, isLoading: authLoading } = useAuth()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Nové heslo musí mať aspoň 8 znakov.')
      return
    }
    if (password !== confirmation) {
      setError('Heslá sa nezhodujú.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setUpdated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Heslo sa nepodarilo zmeniť. Skús to znova.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">Kontrolujem odkaz…</div>

  return (
    <AuthLayout>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-secondary text-text-primary"><KeyRound size={22} /></div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Obnova účtu</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-text-primary">{updated ? 'Heslo je zmenené' : 'Nastaviť nové heslo'}</h1>

      {updated ? (
        <div className="mt-6">
          <p role="status" className="text-sm leading-6 text-text-secondary">Nové heslo je pripravené na použitie.</p>
          <Link to="/login" className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-action-primary px-4 text-sm font-semibold text-on-action-primary">Pokračovať do Coach Foska</Link>
        </div>
      ) : !session ? (
        <div className="mt-6">
          <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-3 text-sm leading-6 text-error">Odkaz na obnovu hesla je neplatný alebo vypršal.</p>
          <Link to="/login/forgot-password" className="mt-7 inline-flex text-sm font-semibold text-text-primary hover:text-accent">Požiadať o nový odkaz</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <Input id="new-password" name="new-password" type="password" label="Nové heslo" placeholder="Aspoň 8 znakov" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required autoFocus />
          <Input id="confirm-password" name="confirm-password" type="password" label="Potvrď nové heslo" placeholder="Zopakuj nové heslo" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required />
          {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
          <Button type="submit" loading={loading} disabled={!password || !confirmation} className="w-full">Uložiť nové heslo</Button>
        </form>
      )}
    </AuthLayout>
  )
}
