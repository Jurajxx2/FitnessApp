import type { ReactNode } from 'react'
import { CheckCircle2, ClipboardCheck, Utensils } from 'lucide-react'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,0.95fr)]">
      <section className="relative hidden overflow-hidden border-r border-outline-subtle bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_18%_18%,rgba(169,7,7,0.2),transparent_35%),radial-gradient(circle_at_82%_78%,rgba(169,7,7,0.1),transparent_34%)]" />
        <p className="relative z-10 text-xs font-extrabold uppercase tracking-[0.24em] text-text-primary">Coach Foska</p>
        <div className="relative z-10 max-w-xl">
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] text-text-primary">Your coaching, clear and close at hand.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-text-secondary">Stay on top of today’s nutrition, your meal plan and weekly progress from any screen.</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-outline-subtle bg-background/70 p-4"><Utensils size={21} className="mb-4 text-accent" /><p className="text-sm font-semibold">Nutrition</p><p className="mt-1 text-xs leading-5 text-text-secondary">Daily targets, meal plans and recipes.</p></div>
            <div className="rounded-2xl border border-outline-subtle bg-background/70 p-4"><ClipboardCheck size={21} className="mb-4 text-accent" /><p className="text-sm font-semibold">Progress</p><p className="mt-1 text-xs leading-5 text-text-secondary">Weekly check-ins shared with your coach.</p></div>
          </div>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-xs text-text-secondary"><CheckCircle2 size={15} className="text-success" /> Secure access for invited Coach Foska clients.</p>
      </section>
      <section className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md"><p className="mb-10 text-xs font-extrabold uppercase tracking-[0.24em] text-text-primary lg:hidden">Coach Foska</p>{children}</div>
      </section>
    </main>
  )
}
