import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { athleteHomePath } from '../lib/access'

export default function NotFound() {
  const { session, profile, isAdmin } = useAuth()
  const home = !session ? '/' : isAdmin ? '/admin' : athleteHomePath(profile)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">404</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-text-primary">Stránka sa nenašla</h1>
      <p className="max-w-md text-sm text-text-secondary">Táto adresa neexistuje alebo bola presunutá.</p>
      <Link to={home} className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-action-primary px-6 text-sm font-bold text-on-action-primary no-underline">
        Späť domov
      </Link>
    </div>
  )
}
