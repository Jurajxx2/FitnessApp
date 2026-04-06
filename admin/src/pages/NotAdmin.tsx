import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

export default function NotAdmin() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">403</div>
        <h1 className="text-xl font-bold text-white mb-2">Access denied</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Your account does not have admin access. Contact the administrator.
        </p>
        <Button variant="ghost" onClick={handleSignOut}>Sign out</Button>
      </div>
    </div>
  )
}
