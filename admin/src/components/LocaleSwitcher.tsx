import { usePublicLocale, type PublicLocale } from '../i18n/PublicLocale'
import { cn } from '../lib/cn'

export function LocaleSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = usePublicLocale()
  const label = locale === 'cs' ? 'Jazyk stránky' : 'Page language'

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex rounded-full border border-outline-subtle bg-surface p-1', className)}
    >
      {(['cs', 'en'] as PublicLocale[]).map(option => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-pressed={locale === option}
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors',
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
