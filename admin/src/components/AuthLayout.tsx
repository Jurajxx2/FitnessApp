import type { ReactNode } from 'react'
import { CheckCircle2, Dumbbell, ShieldCheck, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,0.95fr)]">
      <section className="relative hidden overflow-hidden border-r border-outline-subtle bg-surface lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_18%_18%,rgba(169,7,7,0.24),transparent_35%),radial-gradient(circle_at_82%_78%,rgba(169,7,7,0.12),transparent_34%)]" />
        <Link to="/" className="relative z-10 text-xs font-extrabold uppercase tracking-[0.24em] text-text-primary">
          Coach Foska
        </Link>

        <div className="relative z-10 max-w-xl">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-text-secondary">
            <ShieldCheck size={15} className="text-accent" /> One secure sign-in
          </span>
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] text-text-primary xl:text-6xl">
            Your plan, progress and coaching in one place.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-text-secondary">
            Stay connected to your training, nutrition and progress wherever you are.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-outline-subtle bg-background/70 p-4 backdrop-blur">
              <Utensils size={21} className="mb-4 text-accent" />
              <p className="text-sm font-semibold text-text-primary">Nutrition</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">Nutrition, meal plans, recipes and weekly check-ins.</p>
            </div>
            <div className="rounded-2xl border border-outline-subtle bg-background/70 p-4 backdrop-blur">
              <Dumbbell size={21} className="mb-4 text-accent" />
              <p className="text-sm font-semibold text-text-primary">Training</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">Workouts, exercises, activity history and progress.</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 flex items-center gap-2 text-xs text-text-secondary">
          <CheckCircle2 size={15} className="text-success" /> Secure access to your Coach Foska account.
        </p>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 inline-block text-xs font-extrabold uppercase tracking-[0.24em] text-text-primary lg:hidden">
            Coach Foska
          </Link>
          {children}
        </div>
      </section>
    </main>
  )
}
