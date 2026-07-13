import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardCheck,
  Dumbbell,
  MessageCircle,
  Smartphone,
  Utensils,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { LocaleSwitcher } from '../components/LocaleSwitcher'
import { useAuth } from '../hooks/useAuth'
import { usePublicLocale } from '../i18n/PublicLocale'

const copy = {
  en: {
    loading: 'Loading Coach Foska…',
    navLabel: 'Main navigation',
    nav: [
      ['What you get', 'features'],
      ['How it works', 'how-it-works'],
      ['Mobile apps', 'mobile-apps'],
    ],
    signIn: 'Sign in',
    openApp: 'Open app',
    eyebrow: 'Personal coaching, supported by one simple app',
    title: 'Your training plan. Your nutrition. Your coach.',
    intro: 'Coach Foska keeps the plan from your coach, your daily logs and your progress together—without turning fitness into another full-time job.',
    heroPrimary: 'Sign in to your account',
    heroSecondary: 'See how it works',
    inviteOnly: 'Access is currently available to invited clients.',
    previewTitle: 'Today',
    previewWorkout: 'Upper body strength',
    previewWorkoutMeta: '6 exercises · 48 min',
    previewNutrition: 'Daily nutrition',
    previewNutritionMeta: '1,420 of 2,050 kcal logged',
    previewCheckIn: 'Weekly check-in',
    previewCheckInMeta: 'Ready on Sunday',
    featuresEyebrow: 'One place for the day-to-day work',
    featuresTitle: 'Clear enough to use every day.',
    featuresIntro: 'The app supports the relationship with your coach. It does not pretend to replace it.',
    features: [
      ['Training plans', 'See assigned workouts, log sets and keep your training history in one place.'],
      ['Practical nutrition', 'Follow your meal plan, save recipes and record what you actually eat.'],
      ['Coach check-ins', 'Share progress, notes and photos with the coach who knows your plan.'],
      ['Progress overview', 'Use consistent records to see trends instead of relying on memory.'],
    ],
    howEyebrow: 'How it works',
    howTitle: 'A straightforward coaching workflow.',
    steps: [
      ['Your coach invites you', 'Coach Foska is not an open sign-up service. Your coach prepares access and your starting plan.'],
      ['You follow and record the plan', 'Open the current workout or meal plan, record the essentials and move on with your day.'],
      ['You review progress together', 'Check-ins and history give you and your coach useful context for the next adjustment.'],
    ],
    mobileEyebrow: 'Mobile apps',
    mobileTitle: 'iOS and Android versions are in preparation.',
    mobileBody: 'We are finishing the mobile experience and release setup. Invited clients can use the browser version in the meantime.',
    preparing: 'Preparing release',
    webAvailable: 'Browser access available now',
    webBody: 'Already have an invited account? Use the same sign-in for the current web app.',
    webCta: 'Continue to sign in',
    privacy: 'Privacy',
    terms: 'Terms',
    footerNote: 'Invite-only coaching platform · Mobile apps in preparation',
  },
  cs: {
    loading: 'Načítám Coach Foska…',
    navLabel: 'Hlavní navigace',
    nav: [
      ['Co získáte', 'features'],
      ['Jak to funguje', 'how-it-works'],
      ['Mobilní aplikace', 'mobile-apps'],
    ],
    signIn: 'Přihlásit se',
    openApp: 'Otevřít aplikaci',
    eyebrow: 'Osobní coaching podpořený jednou jednoduchou aplikací',
    title: 'Váš trénink. Vaše strava. Váš trenér.',
    intro: 'Coach Foska spojuje plán od trenéra, každodenní záznamy a váš pokrok na jednom místě—bez toho, aby se z fitness stala další práce na plný úvazek.',
    heroPrimary: 'Přihlásit se k účtu',
    heroSecondary: 'Jak to funguje',
    inviteOnly: 'Přístup je nyní určen klientům s pozvánkou.',
    previewTitle: 'Dnes',
    previewWorkout: 'Síla horní části těla',
    previewWorkoutMeta: '6 cviků · 48 min',
    previewNutrition: 'Denní strava',
    previewNutritionMeta: 'Zapsáno 1 420 z 2 050 kcal',
    previewCheckIn: 'Týdenní check-in',
    previewCheckInMeta: 'Připravený v neděli',
    featuresEyebrow: 'Každodenní práce na jednom místě',
    featuresTitle: 'Jednoduché pro každý den.',
    featuresIntro: 'Aplikace podporuje spolupráci s trenérem. Nesnaží se ho nahrazovat.',
    features: [
      ['Tréninkové plány', 'Prohlédněte si přidělené tréninky, zapisujte série a mějte historii na jednom místě.'],
      ['Praktická výživa', 'Držte se jídelníčku, ukládejte recepty a zapisujte, co jste skutečně snědli.'],
      ['Check-in s trenérem', 'Sdílejte pokrok, poznámky a fotografie s trenérem, který zná váš plán.'],
      ['Přehled pokroku', 'Díky pravidelným záznamům uvidíte vývoj a nemusíte spoléhat na paměť.'],
    ],
    howEyebrow: 'Jak to funguje',
    howTitle: 'Přehledný průběh spolupráce.',
    steps: [
      ['Trenér vás pozve', 'Coach Foska nemá veřejnou registraci. Trenér vám připraví přístup a výchozí plán.'],
      ['Plníte a zapisujete plán', 'Otevřete aktuální trénink nebo jídelníček, zapíšete podstatné údaje a pokračujete ve svém dni.'],
      ['Společně vyhodnotíte pokrok', 'Check-iny a historie dávají vám i trenérovi podklady pro další úpravu plánu.'],
    ],
    mobileEyebrow: 'Mobilní aplikace',
    mobileTitle: 'Verze pro iOS a Android připravujeme.',
    mobileBody: 'Dokončujeme mobilní prostředí a přípravu vydání. Pozvaní klienti mohou mezitím používat webovou verzi.',
    preparing: 'Připravujeme vydání',
    webAvailable: 'Webová verze je dostupná',
    webBody: 'Máte už účet na pozvánku? Pro současnou webovou aplikaci použijte stejné přihlášení.',
    webCta: 'Pokračovat k přihlášení',
    privacy: 'Ochrana soukromí',
    terms: 'Podmínky',
    footerNote: 'Coachingová platforma na pozvání · Mobilní aplikace připravujeme',
  },
} as const

const featureIcons = [Dumbbell, Utensils, MessageCircle, BarChart3]

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
}

export default function Landing() {
  const { locale } = usePublicLocale()
  const t = copy[locale]
  const { session, isAdmin, isLoading, profile } = useAuth()
  const appPath = isAdmin ? '/admin' : '/nutrition'

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-secondary">
        {t.loading}
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background text-text-primary selection:bg-accent">
      <header className="sticky top-0 z-50 border-b border-outline-subtle bg-background/90 backdrop-blur-xl">
        <nav aria-label={t.navLabel} className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="#top" className="shrink-0 text-xs font-extrabold uppercase tracking-[0.24em] text-text-primary">
            Coach Foska
          </a>

          <div className="hidden items-center gap-7 lg:flex">
            {t.nav.map(([label, id]) => (
              <a key={id} href={`#${id}`} className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary">
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher />
            <Link
              to={session ? appPath : '/login'}
              aria-label={session ? t.openApp : t.signIn}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-action-primary px-4 text-xs font-bold text-on-action-primary transition-opacity hover:opacity-85 sm:px-5 sm:text-sm"
            >
              <span className="hidden sm:inline">{session ? t.openApp : t.signIn}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-outline-subtle">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(169,7,7,0.18),transparent_34%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-32">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-accent">{t.eyebrow}</p>
              <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                {t.title}
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg sm:leading-8">{t.intro}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link to={session ? appPath : '/login'} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-action-primary px-6 text-sm font-bold text-on-action-primary transition-opacity hover:opacity-85">
                  {session ? t.openApp : t.heroPrimary} <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-outline bg-surface px-6 text-sm font-bold text-text-primary transition-colors hover:bg-surface-elevated">
                  {t.heroSecondary}
                </a>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs leading-5 text-text-secondary">
                <Check size={15} className="text-success" aria-hidden="true" /> {t.inviteOnly}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.55 }}
              className="mx-auto w-full max-w-lg rounded-[2rem] border border-outline bg-surface p-3 shadow-2xl shadow-black/40"
              aria-label={t.previewTitle}
            >
              <div className="rounded-[1.45rem] border border-outline-subtle bg-background p-5 sm:p-7">
                <div className="mb-7 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">{t.previewTitle}</p>
                    <p className="mt-1 text-lg font-extrabold">{profile?.full_name || 'Coach Foska'}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <ClipboardCheck size={19} aria-hidden="true" />
                  </div>
                </div>

                {[
                  { Icon: Dumbbell, title: t.previewWorkout, meta: t.previewWorkoutMeta },
                  { Icon: Utensils, title: t.previewNutrition, meta: t.previewNutritionMeta },
                  { Icon: MessageCircle, title: t.previewCheckIn, meta: t.previewCheckInMeta },
                ].map(({ Icon, title, meta }, index) => (
                  <div key={String(title)} className={`flex items-center gap-4 py-4 ${index > 0 ? 'border-t border-outline-subtle' : ''}`}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-action-secondary text-text-primary">
                      <Icon size={20} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{title}</p>
                      <p className="mt-1 truncate text-xs text-text-secondary">{meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 border-b border-outline-subtle px-5 py-20 sm:px-8 sm:py-28">
          <motion.div {...reveal} className="mx-auto max-w-7xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{t.featuresEyebrow}</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-2 lg:items-end">
              <h2 className="max-w-2xl text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">{t.featuresTitle}</h2>
              <p className="max-w-xl text-sm leading-7 text-text-secondary lg:justify-self-end sm:text-base">{t.featuresIntro}</p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {t.features.map(([title, body], index) => {
                const Icon = featureIcons[index]
                return (
                  <article key={title} className="rounded-2xl border border-outline-subtle bg-surface p-6 sm:p-7">
                    <Icon size={22} className="text-accent" aria-hidden="true" />
                    <h3 className="mt-6 text-lg font-extrabold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
                  </article>
                )
              })}
            </div>
          </motion.div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-b border-outline-subtle bg-surface px-5 py-20 sm:px-8 sm:py-28">
          <motion.div {...reveal} className="mx-auto max-w-7xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{t.howEyebrow}</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">{t.howTitle}</h2>
            <ol className="mt-12 grid gap-8 lg:grid-cols-3">
              {t.steps.map(([title, body], index) => (
                <li key={title} className="border-t border-outline pt-6">
                  <span className="text-xs font-extrabold text-accent">0{index + 1}</span>
                  <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">{body}</p>
                </li>
              ))}
            </ol>
          </motion.div>
        </section>

        <section id="mobile-apps" className="scroll-mt-24 border-b border-outline-subtle px-5 py-20 sm:px-8 sm:py-28">
          <motion.div {...reveal} className="mx-auto grid max-w-7xl gap-10 rounded-3xl border border-outline-subtle bg-surface p-7 sm:p-10 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:p-14">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{t.mobileEyebrow}</p>
              <h2 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">{t.mobileTitle}</h2>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">{t.mobileBody}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {['iOS', 'Android'].map(platform => (
                <div key={platform} className="rounded-2xl border border-outline bg-background p-5">
                  <Smartphone size={21} className="text-text-secondary" aria-hidden="true" />
                  <p className="mt-5 text-base font-extrabold">{platform}</p>
                  <p className="mt-1 text-xs font-semibold text-text-secondary">{t.preparing}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-[-0.03em]">{t.webAvailable}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{t.webBody}</p>
            </div>
            <Link to={session ? appPath : '/login'} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-action-primary px-6 text-sm font-bold text-on-action-primary transition-opacity hover:opacity-85">
              {session ? t.openApp : t.webCta} <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-subtle bg-surface px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em]">Coach Foska</p>
            <p className="mt-2 text-xs text-text-secondary">© 2026 · {t.footerNote}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-text-secondary">
            <Link to="/privacy" className="transition-colors hover:text-text-primary">{t.privacy}</Link>
            <Link to="/terms" className="transition-colors hover:text-text-primary">{t.terms}</Link>
            <Link to="/login" className="transition-colors hover:text-text-primary">{t.signIn}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
