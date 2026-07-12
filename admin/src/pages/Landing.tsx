import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { 
  Dumbbell, 
  Utensils, 
  LineChart, 
  MessageSquare, 
  Smartphone, 
  ShieldCheck, 
  ArrowRight, 
  Download,
  CheckCircle2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getAthleteAppUrl } from '../lib/athleteApp'
import { useAuth } from '../hooks/useAuth'
import type { DailyQuote } from '../types/database'

const privacyPolicyUrl = import.meta.env.VITE_PRIVACY_POLICY_URL || '#'
const termsOfServiceUrl = import.meta.env.VITE_TERMS_OF_SERVICE_URL || '#'
const contactUrl = import.meta.env.VITE_CONTACT_URL || '#'

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 }
}

const staggerContainer = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

export default function Landing() {
  const navigate = useNavigate()
  const { session, isAdmin, isLoading: authLoading, profile } = useAuth()
  const athleteAppUrl = getAthleteAppUrl()
  const [quote, setQuote] = useState<DailyQuote | null>(null)
  const { scrollYProgress } = useScroll()
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95])

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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-emerald-500 font-black tracking-widest uppercase text-lg"
        >
          Coach Foska
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 selection:bg-emerald-500/30">
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-zinc-900 sticky top-0 bg-[#050505]/80 backdrop-blur-xl z-50">
        <motion.span 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-sm font-black tracking-[0.2em] uppercase text-emerald-500"
        >
          Coach Foska
        </motion.span>
        
        <div className="hidden md:flex items-center gap-10">
          {['About', 'Features', 'How it works'].map((item) => (
            <a 
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} 
              className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
            >
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-6">
          {session ? (
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hidden lg:inline">
                Account: <span className="text-zinc-400">{profile?.full_name || session.user.email}</span>
              </span>
              {isAdmin ? (
                <button
                  onClick={() => navigate('/admin')}
                  className="group flex items-center gap-2 px-5 py-2.5 bg-zinc-100 text-black text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-emerald-400 transition-all active:scale-95"
                >
                  Open admin <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              ) : athleteAppUrl ? (
                <a
                  href={athleteAppUrl}
                  className="group flex items-center gap-2 px-5 py-2.5 bg-zinc-100 text-black text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-emerald-400 transition-all active:scale-95"
                >
                  Open trainee app <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </a>
              ) : null}
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="group flex items-center gap-2 px-6 py-2.5 bg-zinc-100 text-black text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-emerald-400 transition-all active:scale-95"
            >
              Login <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section id="about" className="relative h-[90vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop" 
            alt="Gym Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-[#050505]/40 to-[#050505]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_100%)]" />
        </div>

        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative z-10 flex flex-col items-center"
        >
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Now live on iOS & Android
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-6xl md:text-9xl font-black leading-[0.9] tracking-tighter mb-8 max-w-5xl uppercase"
          >
            Your fitness. <br />
            <span className="text-zinc-700">Forged by</span> <br />
            an expert.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-zinc-400 text-sm md:text-base max-w-lg leading-relaxed mb-12 font-medium tracking-wide"
          >
            Elite workout architecture, calibrated nutrition, and tactical coaching — engineered for those who demand more from themselves.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <button className="flex items-center justify-center gap-2 px-10 py-4 bg-emerald-500 text-black text-[12px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-400 transition-all shadow-[0_0_40px_rgba(16,185,129,0.2)]">
              <Download size={18} /> Download the app
            </button>
            <a href="#features" className="flex items-center justify-center gap-2 px-10 py-4 border border-zinc-800 text-[12px] font-black uppercase tracking-widest rounded-lg hover:bg-zinc-900 transition-all">
              Tactical features
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-6 md:px-12 py-32 max-w-7xl mx-auto">
        <motion.div 
          {...fadeIn}
          className="mb-20 text-center"
        >
          <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Tactical Arsenal</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-6">Built for <span className="text-zinc-700">consistency.</span></h2>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto leading-relaxed">Everything you need to execute your plan with surgical precision.</p>
        </motion.div>

        <motion.div 
          variants={staggerContainer}
          initial="initial"
          whileInView="whileInView"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {[
            { icon: <Dumbbell className="text-emerald-500" />, title: 'Advanced Workouts', desc: 'Surgically structured plans built specifically for your goals and equipment.' },
            { icon: <Utensils className="text-emerald-500" />, title: 'Elite Nutrition', desc: 'Macro-calibrated meal plans designed for performance and effortless adherence.' },
            { icon: <LineChart className="text-emerald-500" />, title: 'Precision Metrics', desc: 'Track every lift, every gram, and every gram of progress with detailed analytics.' },
            { icon: <MessageSquare className="text-emerald-500" />, title: 'Tactical Motivation', desc: 'Fresh perspective and coaching daily to keep your mental fortress impenetrable.' },
            { icon: <Smartphone className="text-emerald-500" />, title: 'Cross-Platform', desc: 'Synchronized ecosystem across iOS and Android. Your coach, always in pocket.' },
            { icon: <ShieldCheck className="text-emerald-500" />, title: 'Total Security', desc: 'Bank-grade encryption for your data. Your journey remains strictly confidential.' },
          ].map((feature, idx) => (
            <motion.div 
              key={idx}
              variants={fadeIn}
              whileHover={{ y: -10, borderColor: 'rgb(16 185 129 / 0.3)' }}
              className="group bg-zinc-900/30 border border-zinc-900 rounded-2xl p-8 hover:bg-zinc-900/50 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight mb-3">{feature.title}</h3>
              <p className="text-zinc-500 text-xs leading-relaxed font-medium">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="px-6 md:px-12 py-32 bg-zinc-950/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div {...fadeIn}>
              <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Operations</p>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-12">The <span className="text-zinc-700">Workflow.</span></h2>
              
              <div className="space-y-12">
                {[
                  { n: '01', title: 'Deployment', desc: 'Download the app and secure your account with simple email auth.' },
                  { n: '02', title: 'Intelligence Gathering', desc: 'Complete the tactical onboarding so your coach can understand your terrain.' },
                  { n: '03', title: 'Mission Planning', desc: 'Receive your custom-engineered workout and nutrition architecture.' },
                  { n: '04', title: 'Execution', desc: 'Execute daily. Track progress. Compound results. Stay disciplined.' },
                ].map((step, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-6"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full border border-emerald-500/30 flex items-center justify-center text-[10px] font-black text-emerald-500">
                      {step.n}
                    </div>
                    <div>
                      <h3 className="text-base font-black uppercase tracking-tight mb-2">{step.title}</h3>
                      <p className="text-zinc-500 text-xs font-medium leading-relaxed max-w-sm">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              {...fadeIn}
              className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/5"
            >
              <img 
                src="https://images.unsplash.com/photo-1594882645126-14020914d58d?q=80&w=2070&auto=format&fit=crop" 
                alt="Tactical App Use" 
                className="w-full h-full object-cover grayscale-[0.5] hover:grayscale-0 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
              <div className="absolute bottom-10 left-10 right-10 p-8 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl">
                <p className="text-zinc-100 text-sm font-black italic mb-2">"Execution is the only thing that matters."</p>
                <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">— Coach Foska</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* QUOTE BANNER */}
      <section className="border-t border-b border-zinc-900 py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500 blur-[150px] rounded-full" />
        </div>
        
        <motion.div 
          {...fadeIn}
          className="relative z-10 text-center px-6"
        >
          <div className="inline-block mb-10 text-zinc-800">
            <CheckCircle2 size={40} />
          </div>
          <blockquote className="text-4xl md:text-7xl font-black tracking-tighter max-w-4xl mx-auto leading-[0.9] uppercase mb-10">
            {quote?.text ?? 'Discipline today. Power tomorrow. Execute without fail.'}
          </blockquote>
          <cite className="text-xs font-black uppercase tracking-[0.4em] text-emerald-500 not-italic">
            — {quote?.author ?? 'Coach Foska'}
          </cite>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 md:px-12 py-20 border-t border-zinc-900 bg-[#050505]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex flex-col items-center md:items-start">
            <span className="text-sm font-black tracking-[0.3em] uppercase text-emerald-500 mb-4">Coach Foska</span>
            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">© 2026 tactical fitness systems</p>
          </div>

          <div className="flex gap-10">
            {[
              { label: 'Privacy', url: privacyPolicyUrl },
              { label: 'Terms', url: termsOfServiceUrl },
              { label: 'Contact', url: contactUrl },
            ].map((link) => (
              <a 
                key={link.label}
                href={link.url} 
                className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-emerald-500 transition-colors cursor-pointer group">
              <Smartphone size={16} className="text-zinc-500 group-hover:text-black" />
            </div>
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-emerald-500 transition-colors cursor-pointer group">
              <LineChart size={16} className="text-zinc-500 group-hover:text-black" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
