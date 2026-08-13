import { beforeEach, describe, expect, it, vi } from 'vitest'
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
      <MemoryRouter initialEntries={['/admin/users/new']}>
        <NoticeProvider>
          <CreateUser onCreated={onCreated} />
        </NoticeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { onCreated, invalidateQueries }
}

describe('CreateUser page', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('invites the athlete, refreshes the list, and opens their profile', async () => {
    invoke.mockResolvedValue({ data: { user: { id: 'athlete-1' } }, error: null })
    const { onCreated, invalidateQueries } = renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Full name'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email address'), 'JANE@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('admin-create-user', {
      body: { fullName: 'Jane Doe', email: 'JANE@example.com' },
      headers: { 'x-request-id': expect.any(String) },
    }))
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['admin-users'] }))
    expect(onCreated).toHaveBeenCalledWith('athlete-1')
  })

  it('reuses the request id after an ambiguous failure and rotates it when input changes', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('network unavailable') })
    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Full name'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email address'), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    await screen.findByRole('alert')
    const firstRequestId = invoke.mock.calls[invoke.mock.calls.length - 1]?.[1]?.headers?.['x-request-id']

    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2))
    expect(invoke.mock.calls[invoke.mock.calls.length - 1]?.[1]?.headers?.['x-request-id']).toBe(firstRequestId)

    await user.type(screen.getByLabelText('Full name'), ' Jr')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(3))
    expect(invoke.mock.calls[invoke.mock.calls.length - 1]?.[1]?.headers?.['x-request-id']).not.toBe(firstRequestId)
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

  it('keeps the request id while a duplicate invitation is still pending', async () => {
    invoke.mockResolvedValue({
      data: { status: 'pending', error: 'pending', requestId: 'server-request' },
      error: null,
      response: new Response(null, { status: 202 }),
    })
    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Full name'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email address'), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('still being confirmed')
    const firstRequestId = invoke.mock.calls[0]?.[1]?.headers?.['x-request-id']

    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2))
    expect(invoke.mock.calls[1]?.[1]?.headers?.['x-request-id']).toBe(firstRequestId)
  })

  it('rotates the request id after a confirmed terminal failure', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new Error('duplicate user'),
      response: new Response(null, { status: 400 }),
    })
    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Full name'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email address'), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    await screen.findByRole('alert')
    const firstRequestId = invoke.mock.calls[0]?.[1]?.headers?.['x-request-id']

    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2))
    expect(invoke.mock.calls[1]?.[1]?.headers?.['x-request-id']).not.toBe(firstRequestId)
  })
})
