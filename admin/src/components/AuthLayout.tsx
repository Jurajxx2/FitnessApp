import type { ReactNode } from 'react'
import { CheckCircle2, Dumbbell, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePublicLocale } from '../i18n/PublicLocale'
import { LocaleSwitcher } from './LocaleSwitcher'

const copy = {
  en: {
    eyebrow: 'Private client workspace',
    title: 'Your plan, progress and coaching in one place.',
    body: 'Stay connected to your training, nutrition and progress wherever you are.',
    nutrition: 'Nutrition',
    nutritionBody: 'Meal plans, recipes, daily logs and weekly check-ins.',
    training: 'Training',
    trainingBody: 'Workouts, exercises, activity history and progress.',
    footer: 'Access is available after an invitation from your coach.',
  },
  cs: {
    eyebrow: 'Soukromý prostor pro klienty',
    title: 'Váš plán, pokrok a spolupráce s trenérem na jednom místě.',
    body: 'Mějte svůj trénink, stravu a pokrok po ruce, ať jste kdekoli.',
    nutrition: 'Výživa',
    nutritionBody: 'Jídelníčky, recepty, denní záznamy a týdenní check-iny.',
    training: 'Trénink',
    trainingBody: 'Tréninky, cviky, historie aktivit a pokrok.',
    footer: 'Přístup získáte na základě pozvánky od trenéra.',
  },
} as const

export function AuthLayout({ children }: { children: ReactNode }) {
  const { locale } = usePublicLocale()
  const t = copy[locale]

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,0.95fr)]">
      <section className="relative hidden overflow-hidden border-r border-outline-subtle bg-surface lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 39px, var(--outline-subtle) 39px, var(--outline-subtle) 40px)' }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="h-5 w-1.5 rounded-full bg-accent-strong" aria-hidden="true" />
            <span className="font-display text-sm font-extrabold uppercase tracking-[0.13em] text-text-primary">Coach Foska</span>
          </Link>
          <LocaleSwitcher />
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="mb-6 flex items-center gap-2 ledger-label text-text-secondary">
            <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h1 className="font-display text-5xl font-bold leading-[1.0] tracking-tight text-text-primary xl:text-6xl">
            {t.title}
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-text-secondary">
            {t.body}
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-outline-subtle bg-background/70 p-4 backdrop-blur">
              <Utensils size={21} className="mb-4 text-accent-strong" />
              <p className="font-display text-sm font-bold text-text-primary">{t.nutrition}</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{t.nutritionBody}</p>
            </div>
            <div className="rounded-2xl border border-outline-subtle bg-background/70 p-4 backdrop-blur">
              <Dumbbell size={21} className="mb-4 text-accent-strong" />
              <p className="font-display text-sm font-bold text-text-primary">{t.training}</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{t.trainingBody}</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 flex items-center gap-2 text-xs text-text-secondary">
          <CheckCircle2 size={15} className="text-success" /> {t.footer}
        </p>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-between gap-4 lg:hidden">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="h-5 w-1.5 rounded-full bg-accent-strong" aria-hidden="true" />
              <span className="font-display text-sm font-extrabold uppercase tracking-[0.13em] text-text-primary">Coach Foska</span>
            </Link>
            <LocaleSwitcher />
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}
