import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button, Card } from '../components/ui'

export default function NotAdmin() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="max-w-sm text-center">
        <div className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">Coach Foska</div>
        <h1 className="mb-2 text-xl font-bold text-text-primary">This account cannot open this workspace</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Continue in the trainee app, or sign in with a different account.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            to="/nutrition"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-transparent bg-action-primary px-4 py-2 text-sm font-semibold text-on-action-primary transition-opacity hover:opacity-85"
          >
            Open athlete app
          </Link>
          <Button variant="ghost" onClick={handleSignOut}>Use a different account</Button>
        </div>
      </Card>
    </div>
  )
}
