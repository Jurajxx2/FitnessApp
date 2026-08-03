import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, ConfirmDialog, DataTable, EmptyState, PageHeader, useNotice } from '../../components/ui'
import type { ActionMenuItem, BulkAction, DataColumn } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { DailyQuote } from '../../types/database'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function applyActiveQuote(quotes: { id: string; is_active: boolean }[], activeId: string) {
  return quotes.map(quote => ({ ...quote, is_active: quote.id === activeId }))
}

function useQuotes(page: number, pageSize: number) {
  return useQuery<{ data: DailyQuote[]; count: number }>({
    queryKey: ['quotes-admin', page, pageSize],
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from('daily_quotes')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (error) throw error
      return { data: data ?? [], count: count ?? 0 }
    },
  })
}

export default function Quotes() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const { data: { data: quotes = [], count: totalCount = 0 } = {}, isLoading, isError } = useQuotes(page, pageSize)
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)

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
    },
  })

  const deleteTargets = deleteIds ? quotes.filter(quote => deleteIds.includes(quote.id)) : []

  async function confirmDelete() {
    if (!deleteIds) return
    setDeleting(true)
    try {
      await Promise.all(deleteIds.map(id => deleteQuote.mutateAsync(id)))
      notify(deleteIds.length > 1 ? `${deleteIds.length} quotes deleted.` : 'Quote deleted.')
      setDeleteIds(null)
    } catch (error) {
      notify(`Couldn’t delete quote${deleteIds.length > 1 ? 's' : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns: DataColumn<DailyQuote>[] = [
    {
      key: 'text',
      header: 'Quote',
      className: 'max-w-xl',
      render: quote => <p className="line-clamp-2 text-sm font-medium text-text-primary">“{quote.text}”</p>,
    },
    { key: 'author', header: 'Author', render: quote => quote.author ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: quote => (quote.is_active ? <span className="text-xs font-semibold text-success">Active</span> : <span className="text-xs text-text-secondary">Inactive</span>),
    },
  ]

  const rowActions = (quote: DailyQuote): ActionMenuItem[] => [
    ...(!quote.is_active ? [{ key: 'activate', label: 'Set active', icon: <Check size={16} />, onSelect: () => setActive.mutate(quote.id) }] : []),
    { key: 'open', label: 'Open', onSelect: () => navigate(`/admin/quotes/${quote.id}`) },
    { key: 'delete', label: 'Delete', variant: 'danger', icon: <Trash2 size={16} />, onSelect: () => setDeleteIds([quote.id]) },
  ]

  const bulkActions = (selected: DailyQuote[]): BulkAction[] => [
    { key: 'delete', label: 'Delete', variant: 'danger', icon: <Trash2 size={16} />, onClick: () => setDeleteIds(selected.map(quote => quote.id)) },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Quotes"
        description="Maintain the motivational message shown in Coach Foska."
        actions={<Button onClick={() => navigate('/admin/quotes/new')}>Add quote</Button>}
      />

      {isError ? (
        <EmptyState title="Quotes couldn’t be loaded" description="Refresh the page to retry." />
      ) : (
        <DataTable<DailyQuote>
          rows={quotes}
          getRowId={quote => quote.id}
          columns={columns}
          rowLabel={quote => `Open quote by ${quote.author ?? 'unknown author'}`}
          onRowActivate={quote => navigate(`/admin/quotes/${quote.id}`)}
          rowActions={rowActions}
          selectable
          bulkActions={bulkActions}
          serverPagination
          page={page}
          pageSize={pageSize}
          totalItems={totalCount}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(0) }}
          loading={isLoading}
          empty={
            <EmptyState
              title="No quotes yet"
              description="Add a quote to set the tone in Coach Foska."
              action={<Button onClick={() => navigate('/admin/quotes/new')}>Add quote</Button>}
            />
          }
        />
      )}

      <ConfirmDialog
        open={deleteIds !== null}
        title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} quotes?` : 'Delete quote?'}
        description={
          deleteIds && deleteIds.length > 1 ? (
            <>{deleteIds.length} quotes will be permanently removed.</>
          ) : deleteTargets[0] ? (
            <>“{deleteTargets[0].text}” will be permanently removed.</>
          ) : (
            <>This quote will be permanently removed.</>
          )
        }
        pending={deleting}
        onClose={() => setDeleteIds(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
