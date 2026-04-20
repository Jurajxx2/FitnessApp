// admin/src/pages/Landing.tsx
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { DailyQuote } from '../types/database'

export default function Landing() {
  const navigate = useNavigate()
  const { session, isAdmin, isLoading: authLoading, profile } = useAuth()
  const [quote, setQuote] = useState<DailyQuote | null>(null)

  useEffect(() => {
    supabase
      .from('daily_quotes')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setQuote(data))
  }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[var(--text-muted)] text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* NAV */}
      <nav className="flex items-center justify-between px-12 py-5 border-b border-[#1a1a1a] sticky top-0 bg-[rgba(10,10,10,0.92)] backdrop-blur-md z-50">
        <span className="text-sm font-extrabold tracking-widest uppercase">Coach Foska</span>
        <div className="flex items-center gap-8">
          <a href="#about"    className="text-sm text-zinc-500 hover:text-white transition-colors">About</a>
          <a href="#features" className="text-sm text-zinc-500 hover:text-white transition-colors">Features</a>
          <a href="#how"      className="text-sm text-zinc-500 hover:text-white transition-colors">How it works</a>
          
          {session ? (
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-500 hidden sm:inline">
                Logged in as <span className="text-zinc-300">{profile?.full_name || session.user.email}</span>
              </span>
              <button
                onClick={() => navigate(isAdmin ? '/admin' : '/403')}
                className="px-5 py-2 bg-white text-black text-sm font-semibold rounded-md hover:opacity-85 transition-opacity cursor-pointer border-0"
              >
                Go to App →
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="px-5 py-2 bg-white text-black text-sm font-semibold rounded-md hover:opacity-85 transition-opacity cursor-pointer border-0"
            >
              Login →
            </button>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section id="about" className="flex flex-col items-center justify-center text-center px-6 py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,255,255,0.04), transparent)' }} />
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-400 mb-8">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
          Now available on Android & iOS
        </div>
        <h1 className="text-6xl md:text-8xl font-extrabold leading-tight tracking-tight mb-6 max-w-3xl">
          Your fitness.<br /><span className="text-zinc-600">Guided by</span> an expert.
        </h1>
        <p className="text-lg text-zinc-500 max-w-md leading-relaxed mb-10">
          Personalised workout plans, nutrition guidance, and daily motivation — all in one place.
        </p>
        <div className="flex gap-3">
          <button className="px-8 py-3.5 bg-white text-black text-sm font-bold rounded-lg hover:opacity-85 transition-opacity cursor-pointer border-0">
            Download the app
          </button>
          <a href="#features" className="px-8 py-3.5 text-sm font-semibold border border-zinc-800 rounded-lg hover:border-zinc-600 transition-colors">
            Learn more
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-12 py-20 max-w-6xl mx-auto">
        <p className="text-xs text-zinc-600 uppercase tracking-widest mb-4">What you get</p>
        <h2 className="text-4xl font-extrabold tracking-tight mb-3">Everything your<br />fitness journey needs.</h2>
        <p className="text-zinc-500 text-base max-w-md leading-relaxed mb-12">Built around your goals, designed to keep you consistent.</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: '🏋️', title: 'Personalised Workouts',  desc: 'Plans built by your coach, structured for your schedule.' },
            { icon: '🥗', title: 'Nutrition Guidance',     desc: 'Meal plans calibrated to your macros and lifestyle.' },
            { icon: '📈', title: 'Progress Tracking',      desc: 'Log weight, track workouts, watch results compound.' },
            { icon: '💬', title: 'Daily Motivation',       desc: 'A fresh quote from your coach every single day.' },
            { icon: '📱', title: 'Android & iOS',          desc: 'Native app on both platforms, always in sync.' },
            { icon: '🔒', title: 'Private & Secure',       desc: 'Your data belongs to you. Secured end-to-end.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-zinc-700 transition-colors">
              <div className="w-9 h-9 bg-zinc-900 rounded-lg flex items-center justify-center text-base mb-4">{icon}</div>
              <h3 className="text-sm font-bold mb-2">{title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-zinc-900" />

      {/* HOW IT WORKS */}
      <section id="how" className="px-12 py-20 max-w-6xl mx-auto">
        <p className="text-xs text-zinc-600 uppercase tracking-widest mb-4">How it works</p>
        <h2 className="text-4xl font-extrabold tracking-tight mb-12">Simple. Structured. Effective.</h2>
        <div className="grid grid-cols-4 gap-6">
          {[
            { n: 1, title: 'Download & sign up',     desc: 'Create your account with just your email.' },
            { n: 2, title: 'Complete onboarding',    desc: 'Share your goals so your coach can personalise your plan.' },
            { n: 3, title: 'Get your plan',          desc: 'Your coach assigns a tailored workout and meal plan.' },
            { n: 4, title: 'Train & track',          desc: 'Follow your plan daily and watch results compound.' },
          ].map(({ n, title, desc }) => (
            <div key={n}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-4 ${n === 1 ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-600'}`}>
                {n}
              </div>
              <h3 className="text-sm font-bold mb-2">{title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* QUOTE BANNER */}
      <div className="border-t border-b border-zinc-900 py-16 text-center px-6">
        <blockquote className="text-3xl font-bold tracking-tight max-w-2xl mx-auto leading-snug mb-3">
          <span className="text-zinc-700">"</span>
          {quote?.text ?? 'Every rep counts. Show up, push hard, earn it.'}
          <span className="text-zinc-700">"</span>
        </blockquote>
        <cite className="text-xs text-zinc-600 not-italic">— {quote?.author ?? 'Coach Foska'}</cite>
      </div>

      {/* FOOTER */}
      <footer className="flex items-center justify-between px-12 py-8 border-t border-zinc-900">
        <span className="text-xs font-extrabold tracking-widest uppercase text-zinc-700">Coach Foska</span>
        <div className="flex gap-6">
          <a href="#" className="text-xs text-zinc-600 hover:text-zinc-400">Privacy Policy</a>
          <a href="#" className="text-xs text-zinc-600 hover:text-zinc-400">Terms</a>
          <a href="#" className="text-xs text-zinc-600 hover:text-zinc-400">Contact</a>
        </div>
        <span className="text-xs text-zinc-800">© 2026 Coach Foska</span>
      </footer>
    </div>
  )
}
