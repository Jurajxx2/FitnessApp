import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button, Card } from '../components/ui'
import { usePublicLocale } from '../i18n/PublicLocale'

export const copy = {
  en: {
    title: 'Access unavailable',
    body: 'This account does not have access to the requested page.',
    back: 'Back to Coach Foska',
    differentAccount: 'Use a different account',
  },
  cs: {
    title: 'Přístup není dostupný',
    body: 'Tento účet nemá přístup k požadované stránce.',
    back: 'Zpět na Coach Foska',
    differentAccount: 'Použít jiný účet',
  },
  sk: {
    title: 'Prístup nie je dostupný',
    body: 'Tento účet nemá prístup k požadovanej stránke.',
    back: 'Späť na Coach Foska',
    differentAccount: 'Použiť iný účet',
  },
} as const

export default function NotAdmin() {
  const navigate = useNavigate()
  const { locale } = usePublicLocale()
  const t = copy[locale]

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="max-w-sm text-center">
        <div className="mb-4 ledger-label text-text-secondary">Coach Foska</div>
        <h1 className="mb-2 font-display text-xl font-bold tracking-tight text-text-primary">{t.title}</h1>
        <p className="mb-6 text-sm text-text-secondary">
          {t.body}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            to="/"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-transparent bg-action-primary px-4 py-2 text-sm font-semibold text-on-action-primary transition-opacity hover:opacity-85"
          >
            {t.back}
          </Link>
          <Button variant="ghost" onClick={handleSignOut}>{t.differentAccount}</Button>
        </div>
      </Card>
    </div>
  )
}
