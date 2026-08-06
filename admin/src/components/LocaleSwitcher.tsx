import { usePublicLocale, type PublicLocale } from '../i18n/PublicLocale'
import { cn } from '../lib/cn'

const groupLabel: Record<PublicLocale, string> = {
  sk: 'Jazyk stránky',
  cs: 'Jazyk stránky',
  en: 'Page language',
}

export function LocaleSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = usePublicLocale()
  const label = groupLabel[locale]

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex rounded-full border border-outline-subtle bg-surface p-1', className)}
    >
      {(['sk', 'cs', 'en'] as PublicLocale[]).map(option => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-pressed={locale === option}
          className={cn(
            'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-[11px] font-mono font-bold uppercase tracking-[0.12em] transition-colors',
            locale === option
              ? 'bg-action-primary text-on-action-primary'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
