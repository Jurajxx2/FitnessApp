import { AlertTriangle, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/ui'
import { supabase } from '../lib/supabase'

export default function AdminMfaRecovery() {
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <AuthLayout>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning">
        <AlertTriangle size={23} aria-hidden="true" />
      </div>
      <p className="ledger-label text-text-secondary">Admin security recovery</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text-primary">Lost your authenticator?</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        Supabase does not provide recovery codes. Ask an authorized Coach Foska operator to verify your identity and remove the lost factor or an abandoned incomplete setup. Never send a one-time code or setup key by email or chat.
      </p>
      <div className="mt-6 rounded-2xl border border-outline-subtle bg-surface p-5">
        <h2 className="font-display text-lg font-bold text-text-primary">What happens next</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-text-secondary">
          <li>The operator verifies your identity outside this account.</li>
          <li>The exact lost or incomplete factor is removed using the protected recovery procedure.</li>
          <li>You sign in again and connect a new authenticator before admin access is restored.</li>
        </ol>
      </div>
      <div className="mt-6 flex flex-col gap-2">
        <Link to="/admin/mfa" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-action-primary px-4 text-sm font-semibold text-on-action-primary">Try another authenticator</Link>
        <Button variant="ghost" onClick={() => void signOut()}><LogOut size={17} aria-hidden="true" /> Sign out</Button>
      </div>
    </AuthLayout>
  )
}
