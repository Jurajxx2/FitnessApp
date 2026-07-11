// admin/src/pages/admin/Quotes.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, ConfirmDialog, EmptyState, Input, Modal, PageHeader, Table, Th, Td, useNotice } from '../../components/ui'
import type { DailyQuote } from '../../types/database'

// Exported for unit testing
export function applyActiveQuote(
  quotes: { id: string; is_active: boolean }[],
  activeId: string
) {
  return quotes.map(q => ({ ...q, is_active: q.id === activeId }))
}

function useQuotes() {
  return useQuery<DailyQuote[]>({
    queryKey: ['quotes-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_quotes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export default function Quotes() {
  const qc = useQueryClient()
  const { notify } = useNotice()
  const { data: quotes = [], isLoading, isError } = useQuotes()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<DailyQuote | null>(null)
  const [form, setForm] = useState({ text: '', author: '', scheduled_date: '' })
  const [deleteTarget, setDeleteTarget] = useState<DailyQuote | null>(null)

  function openCreate() {
    setEditing(null)
    setForm({ text: '', author: '', scheduled_date: '' })
    setEditorOpen(true)
  }

  function openEdit(q: DailyQuote) {
    setEditing(q)
    setForm({ text: q.text, author: q.author ?? '', scheduled_date: q.scheduled_date ?? '' })
    setEditorOpen(true)
  }

  const saveQuote = useMutation({
    mutationFn: async () => {
      const payload = {
        text: form.text,
        author: form.author || null,
        scheduled_date: form.scheduled_date || null,
      }
      if (editing) {
        const { error } = await supabase.from('daily_quotes').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('daily_quotes').insert({ ...payload, is_active: false })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes-admin'] })
      setEditorOpen(false)
      notify(editing ? 'Quote updated.' : 'Quote added.')
    },
    onError: error => notify(`Couldn’t save quote: ${error.message}`, 'error'),
  })

  const setActive = useMutation({
    mutationFn: async (id: string) => {
      const { error: err1 } = await supabase
        .from('daily_quotes')
        .update({ is_active: false })
        .neq('id', id)
      if (err1) throw err1
      const { error: err2 } = await supabase
        .from('daily_quotes')
        .update({ is_active: true })
        .eq('id', id)
      if (err2) throw err2
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes-admin'] })
      qc.invalidateQueries({ queryKey: ['active-quote'] })
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
      qc.invalidateQueries({ queryKey: ['quotes-admin'] })
      setDeleteTarget(null)
      notify('Quote deleted.')
    },
    onError: error => notify(`Couldn’t delete quote: ${error.message}`, 'error'),
  })

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Quotes" description="Keep the daily message in the athlete app fresh." actions={<Button onClick={openCreate}>+ Add quote</Button>} />

      {isLoading ? (
        <p className="text-sm text-[var(--text-disabled)]">Loading…</p>
      ) : isError ? (
        <EmptyState title="Quotes couldn’t be loaded" description="Refresh the page to retry." />
      ) : quotes.length === 0 ? (
        <EmptyState title="No quotes yet" description="Add a quote to set the tone in the athlete app." action={<Button onClick={openCreate}>Add quote</Button>} />
      ) : (
        <Table>
          <thead>
            <tr><Th>Quote</Th><Th>Author</Th><Th>Scheduled</Th><Th>Status</Th><Th>{''}</Th></tr>
          </thead>
          <tbody>
            {quotes.map(q => (
              <tr key={q.id} className="hover:bg-[var(--bg-card-hover)]">
                <Td className="max-w-xs">
                  <p className="text-sm text-[var(--text)] truncate">{q.text}</p>
                </Td>
                <Td>{q.author ?? '—'}</Td>
                <Td>{q.scheduled_date ?? '—'}</Td>
                <Td>
                  {q.is_active
                    ? <span className="text-green-400 text-xs font-semibold">● Active</span>
                    : <span className="text-[var(--text-disabled)] text-xs">Inactive</span>}
                </Td>
                <Td>
                  <div className="flex gap-2 flex-wrap">
                    {!q.is_active && (
                      <button
                        onClick={() => setActive.mutate(q.id)}
                        disabled={setActive.isPending}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border border-[var(--border)] rounded px-2 py-0.5 cursor-pointer"
                      >
                        Set active
                      </button>
                    )}
                    <button onClick={() => openEdit(q)} className="text-xs font-medium text-text-secondary hover:text-text-primary bg-transparent border-0 cursor-pointer">Edit</button>
                    <button
                      onClick={() => setDeleteTarget(q)}
                      className="text-xs font-medium text-error bg-transparent border-0 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Edit Quote' : 'New Quote'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveQuote.mutate()} loading={saveQuote.isPending} disabled={!form.text}>
              {editing ? 'Save changes' : 'Add quote'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Quote text</label>
            <textarea
              className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--text-muted)] resize-none"
              rows={4}
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              placeholder="Enter the quote text…"
            />
          </div>
          <Input label="Author" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="e.g. Coach Foska" />
          <Input label="Scheduled date (optional)" type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
        </div>
      </Modal>

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
