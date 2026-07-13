import { useState } from 'react'
import { ShieldX } from 'lucide-react'
import { Button, Card } from './ui'
import { supabase } from '../lib/supabase'

export function BlockedAccount() {
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    setSigningOut(false)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-7 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
          <ShieldX size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold text-text-primary">Account access is blocked</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          This account cannot access Coach Foska data. Contact your coach if you believe this is a mistake.
        </p>
        <Button variant="ghost" className="mt-6 w-full" onClick={signOut} loading={signingOut}>Sign out</Button>
      </Card>
    </main>
  )
}
