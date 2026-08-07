import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { NoticeProvider, useNotice } from './Notice'

function Trigger() {
  const { notify } = useNotice()
  return <button onClick={() => notify('Uložené', 'success')}>Notify</button>
}

// NoticeProvider now derives its locale from useLocation(), so every render needs a
// surrounding Router — this mirrors how RootLayout mounts it in App.tsx.
function renderWithRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <NoticeProvider>
        <Trigger />
      </NoticeProvider>
    </MemoryRouter>,
  )
}

describe('Notice', () => {
  it('clears the mobile bottom nav and the LogMeal save bar with a safe-area-aware offset, and resets it back to bottom-4 on desktop', async () => {
    renderWithRoute('/nutrition')

    await userEvent.click(screen.getByRole('button', { name: 'Notify' }))

    const status = await screen.findByRole('status')
    const container = status.parentElement as HTMLElement
    // 9rem, not just 5rem: the fixed LogMeal save bar (LogMeal.tsx) sits above the athlete
    // bottom nav at bottom-[calc(4rem+safe)] and is ~4.3rem tall, so its top edge is at
    // ~8.3rem — a toast at only 5rem would paint over it (and win on z-index), re-creating
    // the exact tap-steal the save-bar fix was meant to remove.
    expect(container.className).toContain('bottom-[calc(9rem+env(safe-area-inset-bottom))]')
    expect(container.className).toContain('md:bottom-4')
  })

  it('renders the Slovak dismiss aria-label on an athlete path', async () => {
    renderWithRoute('/nutrition')

    await userEvent.click(screen.getByRole('button', { name: 'Notify' }))

    expect(await screen.findByRole('button', { name: 'Zavrieť upozornenie' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dismiss notification' })).not.toBeInTheDocument()
  })

  it('renders the English dismiss aria-label on an /admin path', async () => {
    renderWithRoute('/admin/users')

    await userEvent.click(screen.getByRole('button', { name: 'Notify' }))

    expect(await screen.findByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zavrieť upozornenie' })).not.toBeInTheDocument()
  })

  it('sizes the close button to at least the 44px athlete touch target', async () => {
    renderWithRoute('/nutrition')

    await userEvent.click(screen.getByRole('button', { name: 'Notify' }))

    const closeButton = await screen.findByRole('button', { name: 'Zavrieť upozornenie' })
    expect(closeButton.className).toContain('min-h-11')
    expect(closeButton.className).toContain('min-w-11')
  })

  it('keeps a notice visible across a route change now that NoticeProvider wraps the router outlet', async () => {
    function Page({ path, to }: { path: string; to: string }) {
      const { notify } = useNotice()
      const navigate = useNavigate()
      return (
        <div>
          <p>On {path}</p>
          <button onClick={() => notify('Uložené', 'success')}>Notify</button>
          <button onClick={() => navigate(to)}>Navigate</button>
        </div>
      )
    }

    render(
      <MemoryRouter initialEntries={['/nutrition']}>
        <NoticeProvider>
          <Routes>
            <Route path="/nutrition" element={<Page path="/nutrition" to="/profile" />} />
            <Route path="/profile" element={<Page path="/profile" to="/nutrition" />} />
          </Routes>
        </NoticeProvider>
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Notify' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Uložené')

    await userEvent.click(screen.getByRole('button', { name: 'Navigate' }))
    expect(await screen.findByText('On /profile')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Uložené')
  })
})
