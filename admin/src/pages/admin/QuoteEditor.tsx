import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Quote as QuoteIcon } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, EditorPage, EmptyState, FormSection, Input, Shimmer, useNotice } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { DailyQuote } from '../../types/database'

function useQuote(id: string | undefined) {
  return useQuery<DailyQuote>({
    queryKey: ['quote-admin', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('daily_quotes').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

export default function QuoteEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const { data: quote, isLoading, isError, error } = useQuote(id)
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')

  useEffect(() => {
    if (!quote) return
    setText(quote.text)
    setAuthor(quote.author ?? '')
  }, [quote])

  const saveQuote = useMutation({
    mutationFn: async () => {
      const payload = { text: text.trim(), author: author.trim() || null }
      if (id) {
        const { error: updateError } = await supabase.from('daily_quotes').update(payload).eq('id', id)
        if (updateError) throw updateError
        return id
      }
      const { data, error: insertError } = await supabase.from('daily_quotes').insert({ ...payload, is_active: false }).select('id').single()
      if (insertError) throw insertError
      return data.id
    },
    onSuccess: quoteId => {
      queryClient.invalidateQueries({ queryKey: ['quotes-admin'] })
      queryClient.invalidateQueries({ queryKey: ['quote-admin', quoteId] })
      notify(isNew ? 'Quote added.' : 'Quote updated.')
      if (isNew) navigate(`/admin/quotes/${quoteId}`, { replace: true })
    },
    onError: mutationError => notify(`Couldn’t save quote: ${mutationError.message}`, 'error'),
  })

  if (!isNew && isLoading) {
    return <EditorPage backTo="/admin/quotes" backLabel="Back to quotes" eyebrow="Athlete message" title="Loading quote…"><Shimmer className="h-72 w-full" /></EditorPage>
  }

  if (!isNew && (isError || !quote)) {
    return <EditorPage backTo="/admin/quotes" backLabel="Back to quotes" eyebrow="Athlete message" title="Quote unavailable"><EmptyState title="This quote couldn’t be loaded" description={error?.message ?? 'It may have been removed.'} /></EditorPage>
  }

  return (
    <EditorPage
      backTo="/admin/quotes"
      backLabel="Back to quotes"
      eyebrow="Athlete message"
      title={isNew ? 'Add quote' : 'Edit quote'}
      description="Write a concise message that feels natural in the athlete dashboard. Activation remains a deliberate action from the quote list."
      maxWidth="5xl"
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate('/admin/quotes')}>Cancel</Button>
          <Button onClick={() => saveQuote.mutate()} loading={saveQuote.isPending} disabled={!text.trim()}>{isNew ? 'Add quote' : 'Save changes'}</Button>
        </>
      }
      aside={
        <Card>
          <QuoteIcon size={22} className="text-accent" aria-hidden="true" />
          <blockquote className="mt-4 text-lg font-semibold leading-7 text-text-primary">“{text || 'Your message will preview here.'}”</blockquote>
          <p className="mt-3 text-sm text-text-secondary">— {author || 'Coach Foska'}</p>
          {quote?.is_active && <p className="mt-5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-center text-xs font-semibold text-success">Currently active</p>}
        </Card>
      }
    >
      <FormSection title="Message" description="Scheduling has intentionally been removed from this form because the app does not currently run scheduled activation.">
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Quote text</label>
            <textarea
              className="min-h-40 w-full resize-y rounded-xl border border-outline bg-surface px-3 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-secondary focus:border-accent"
              value={text}
              onChange={event => setText(event.target.value)}
              placeholder="Progress is built one consistent choice at a time."
              maxLength={500}
              autoFocus={isNew}
            />
            <p className="mt-1 text-right text-xs text-text-secondary">{text.length}/500</p>
          </div>
          <Input label="Author" value={author} onChange={event => setAuthor(event.target.value)} placeholder="Coach Foska" maxLength={120} />
        </div>
      </FormSection>

      {saveQuote.error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{saveQuote.error.message}</p>}
    </EditorPage>
  )
}
