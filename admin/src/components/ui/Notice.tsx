import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'

type NoticeTone = 'success' | 'error'

const COPY = {
  en: { dismiss: 'Dismiss notification' },
  sk: { dismiss: 'Zavrieť upozornenie' },
} as const

interface Notice {
  id: number
  tone: NoticeTone
  message: string
}

interface NoticeContextValue {
  notify: (message: string, tone?: NoticeTone) => void
}

const NoticeContext = createContext<NoticeContextValue>({ notify: () => {} })

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([])
  // NoticeProvider wraps the whole route tree (mounted once in RootLayout, inside
  // RouterProvider), so it derives locale from the current path rather than taking a
  // `locale` prop from a call site the way leaf ui/* components do — there is no single
  // call site, and admin/athlete surfaces share this one provider instance.
  const location = useLocation()
  const locale = location.pathname.startsWith('/admin') ? 'en' : 'sk'
  const t = COPY[locale]

  const dismiss = useCallback((id: number) => {
    setNotices(current => current.filter(notice => notice.id !== id))
  }, [])

  const notify = useCallback((message: string, tone: NoticeTone = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setNotices(current => [...current, { id, tone, message }].slice(-3))
  }, [])

  useEffect(() => {
    if (!notices.length) return
    const timers = notices.map(notice => window.setTimeout(() => dismiss(notice.id), notice.tone === 'error' ? 7_000 : 4_000))
    return () => timers.forEach(window.clearTimeout)
  }, [dismiss, notices])

  return (
    <NoticeContext.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96 md:bottom-4">
        {notices.map(notice => {
          const isError = notice.tone === 'error'
          const Icon = isError ? CircleAlert : CheckCircle2
          return (
            <div key={notice.id} role="status" className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-3 shadow-xl ${isError ? 'border-error/40 bg-surface-elevated text-error' : 'border-success/40 bg-surface-elevated text-text-primary'}`}>
              <Icon size={18} className={isError ? 'mt-0.5 flex-shrink-0' : 'mt-0.5 flex-shrink-0 text-success'} aria-hidden="true" />
              <p className="flex-1 text-sm leading-5">{notice.message}</p>
              <button onClick={() => dismiss(notice.id)} className="inline-flex min-h-11 min-w-11 flex-shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-text-secondary hover:text-text-primary" aria-label={t.dismiss}>
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </NoticeContext.Provider>
  )
}

export function useNotice() {
  return useContext(NoticeContext)
}
