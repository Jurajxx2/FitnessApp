import { useNavigate } from 'react-router-dom'
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
        <div className="mb-4 text-5xl font-extrabold tracking-tight text-text-primary">403</div>
        <h1 className="mb-2 text-xl font-bold text-text-primary">Access denied</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Your account does not have admin access. Contact the administrator.
        </p>
        <Button variant="ghost" onClick={handleSignOut}>Sign out</Button>
      </Card>
    </div>
  )
}
