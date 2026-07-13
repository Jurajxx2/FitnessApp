import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button, ConfirmDialog, EmptyState, PageHeader, Table, Td, Th, useNotice } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { DailyQuote } from '../../types/database'

export function applyActiveQuote(quotes: { id: string; is_active: boolean }[], activeId: string) {
  return quotes.map(quote => ({ ...quote, is_active: quote.id === activeId }))
}

function useQuotes() {
  return useQuery<DailyQuote[]>({
    queryKey: ['quotes-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('daily_quotes').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export default function Quotes() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const { data: quotes = [], isLoading, isError } = useQuotes()
  const [deleteTarget, setDeleteTarget] = useState<DailyQuote | null>(null)

  const setActive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_activate_quote', { p_quote_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes-admin'] })
      queryClient.invalidateQueries({ queryKey: ['active-quote'] })
      notify('Active quote updated.')
    },
    onError: error => notify(`Couldn’t activate quote: ${error.message}`, 'error'),
  })

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('daily_quotes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes-admin'] })
      setDeleteTarget(null)
      notify('Quote deleted.')
    },
    onError: error => notify(`Couldn’t delete quote: ${error.message}`, 'error'),
  })

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Quotes"
        description="Maintain the motivational message shown in Coach Foska."
        actions={<Button onClick={() => navigate('/admin/quotes/new')}>Add quote</Button>}
      />

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : isError ? (
        <EmptyState title="Quotes couldn’t be loaded" description="Refresh the page to retry." />
      ) : quotes.length === 0 ? (
        <EmptyState title="No quotes yet" description="Add a quote to set the tone in Coach Foska." action={<Button onClick={() => navigate('/admin/quotes/new')}>Add quote</Button>} />
      ) : (
        <Table>
          <thead><tr><Th>Quote</Th><Th>Author</Th><Th>Status</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
          <tbody>
            {quotes.map(quote => (
              <tr key={quote.id} className="hover:bg-surface-highest">
                <Td className="max-w-xl"><p className="line-clamp-2 text-sm font-medium text-text-primary">“{quote.text}”</p></Td>
                <Td>{quote.author ?? '—'}</Td>
                <Td>{quote.is_active ? <span className="text-xs font-semibold text-success">Active</span> : <span className="text-xs text-text-secondary">Inactive</span>}</Td>
                <Td>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {!quote.is_active && <Button variant="secondary" className="min-h-9 px-3" onClick={() => setActive.mutate(quote.id)} loading={setActive.isPending}>Set active</Button>}
                    <Button variant="ghost" className="min-h-9 px-3" onClick={() => navigate(`/admin/quotes/${quote.id}`)}>Open</Button>
                    <Button variant="danger" className="min-h-9 px-3" onClick={() => setDeleteTarget(quote)}>Delete</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete quote?"
        description={<>“{deleteTarget?.text}” will be permanently removed.</>}
        pending={deleteQuote.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteQuote.mutate(deleteTarget.id)}
      />
    </div>
  )
}
