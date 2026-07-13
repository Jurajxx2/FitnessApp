import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NoticeProvider } from '../../components/ui'
import CreateUser from './CreateUser'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke } } }))

function renderPage(onCreated = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <MemoryRouter initialEntries={['/admin/users/new']}>
          <CreateUser onCreated={onCreated} />
        </MemoryRouter>
      </NoticeProvider>
    </QueryClientProvider>
  )
  return { onCreated, invalidateQueries }
}

describe('CreateUser page', () => {
  it('invites the athlete, refreshes the list, and opens their profile', async () => {
    invoke.mockResolvedValue({ data: { user: { id: 'athlete-1', email: 'jane@example.com' } }, error: null })
    const { onCreated, invalidateQueries } = renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Full name'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email address'), 'JANE@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('admin-create-user', {
      body: { fullName: 'Jane Doe', email: 'JANE@example.com' },
    }))
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['admin-users'] }))
    expect(onCreated).toHaveBeenCalledWith('athlete-1')
  })

  it('shows a safe error when the invitation cannot be created', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('duplicate user') })
    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Full name'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email address'), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t create this athlete')
  })
})
