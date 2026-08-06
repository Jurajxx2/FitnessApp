import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, SendHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Shimmer, useNotice } from '../components/ui'
import {
  fetchMyMessages,
  markCoachMessagesRead,
  sendImageMessage,
  sendTextMessage,
} from '../chat/athleteApi'
import { ChatImage } from '../chat/ChatImage'

function formatMessageTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
}

export default function Messages() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)

  const messagesQuery = useQuery({
    queryKey: ['athlete-chat', userId],
    queryFn: () => fetchMyMessages(userId),
    enabled: Boolean(userId),
  })
  const messages = messagesQuery.data ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Mark coach messages read while the thread is open.
  useEffect(() => {
    if (!userId || !messages.some(item => item.sender_type === 'coach' && item.read_at === null)) return

    markCoachMessagesRead(userId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['athlete-chat', userId] })
        queryClient.invalidateQueries({ queryKey: ['athlete-chat-unread', userId] })
      })
      .catch(() => {
        // Reading status is non-critical; leave it to the next successful refresh.
      })
  }, [userId, messages, queryClient])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`athlete-chat-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['athlete-chat', userId] })
          queryClient.invalidateQueries({ queryKey: ['athlete-chat-unread', userId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  const sendText = useMutation({
    mutationFn: (message: string) => sendTextMessage(userId, message),
    onSuccess: () => {
      setText('')
      queryClient.invalidateQueries({ queryKey: ['athlete-chat', userId] })
    },
    onError: () => notify('Správu sa nepodarilo odoslať.', 'error'),
  })
  const sendImage = useMutation({
    mutationFn: (file: File) => sendImageMessage(userId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['athlete-chat', userId] }),
    onError: () => notify('Fotografiu sa nepodarilo odoslať.', 'error'),
  })

  function handleSend() {
    if (!text.trim()) return
    sendText.mutate(text.trim())
  }

  if (messagesQuery.isLoading) return <Shimmer className="h-64 w-full" />

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-96 flex-col">
      <div>
        <p className="flex items-center gap-2 ledger-label text-text-secondary">
          <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
          Chat s trénerkou
        </p>
        <h1 className="mt-1 text-3xl font-display font-bold tracking-tight text-text-primary">Správy</h1>
        <p className="mt-2 text-sm text-text-secondary">Napíš svojej trénerke — odpovie ti čo najskôr.</p>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-outline-subtle bg-surface-elevated p-4">
        {messages.length === 0 && (
          <p className="m-auto text-sm text-text-secondary">Zatiaľ žiadne správy. Napíš prvú!</p>
        )}
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm sm:max-w-[65%] ${message.sender_type === 'user' ? 'bg-action-primary text-on-action-primary' : 'bg-surface text-text-primary'}`}>
              {message.content_type === 'image' && message.image_url ? (
                <ChatImage
                  imageRef={message.image_url}
                  alt="Príloha"
                  className="max-w-52 rounded-lg"
                  unavailableText="Obrázok sa nepodarilo načítať."
                />
              ) : (
                <p className="whitespace-pre-wrap break-words">{message.text_content}</p>
              )}
              <p className={`mt-1 text-[10px] ${message.sender_type === 'user' ? 'opacity-70' : 'text-text-secondary'}`}>
                {formatMessageTime(message.created_at)}
                {message.sender_type === 'user' && message.read_at && ' ✓'}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex items-end gap-2">
        <input
          ref={imageInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) sendImage.mutate(file)
            event.target.value = ''
          }}
        />
        <button
          type="button"
          aria-label="Poslať fotografiu"
          disabled={sendImage.isPending}
          onClick={() => imageInput.current?.click()}
          className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border border-outline bg-surface text-text-secondary hover:text-text-primary disabled:opacity-40"
        >
          <ImagePlus size={18} />
        </button>
        <textarea
          rows={2}
          value={text}
          placeholder="Napíš správu… (Enter odošle)"
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSend()
            }
          }}
          className="flex-1 resize-none rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent"
        />
        <button
          type="button"
          aria-label="Odoslať"
          onClick={handleSend}
          disabled={!text.trim() || sendText.isPending}
          className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border-0 bg-action-primary text-on-action-primary disabled:opacity-40"
        >
          <SendHorizontal size={18} />
        </button>
      </div>
    </div>
  )
}
