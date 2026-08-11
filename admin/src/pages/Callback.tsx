import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePublicLocale } from '../i18n/PublicLocale'
import { useAuth, useAuthAssurance } from '../hooks/useAuth'
import { postAuthDestination } from '../lib/authDestination'

export const copy = {
  en: { signingIn: 'Signing you in…' },
  cs: { signingIn: 'Přihlašuji vás…' },
  sk: { signingIn: 'Prihlasujem ťa…' },
} as const

export default function Callback() {
  const navigate = useNavigate()
  const { locale } = usePublicLocale()
  const { session, profile, isLoading } = useAuth()
  const assurance = useAuthAssurance()

  useEffect(() => {
    if (isLoading || assurance.isLoading) return
    if (!session) {
      navigate('/login', { replace: true })
      return
    }
    navigate(postAuthDestination(profile, {
      currentLevel: assurance.currentLevel,
      error: assurance.error,
    }), { replace: true })
  }, [assurance.currentLevel, assurance.error, assurance.isLoading, isLoading, navigate, profile, session])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <p className="text-sm text-text-secondary">{copy[locale].signingIn}</p>
    </div>
  )
}
