import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'

type NoticeTone = 'success' | 'error'

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
      <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96">
        {notices.map(notice => {
          const isError = notice.tone === 'error'
          const Icon = isError ? CircleAlert : CheckCircle2
          return (
            <div key={notice.id} role="status" className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-3 shadow-xl ${isError ? 'border-error/40 bg-surface-elevated text-error' : 'border-success/40 bg-surface-elevated text-text-primary'}`}>
              <Icon size={18} className={isError ? 'mt-0.5 flex-shrink-0' : 'mt-0.5 flex-shrink-0 text-success'} aria-hidden="true" />
              <p className="flex-1 text-sm leading-5">{notice.message}</p>
              <button onClick={() => dismiss(notice.id)} className="cursor-pointer border-0 bg-transparent p-0 text-text-secondary hover:text-text-primary" aria-label="Dismiss notification">
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
