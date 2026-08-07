import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router-dom'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'

// A harness that owns its own dirty flag (toggled by the test, mirroring how a
// real page derives isDirty from its own form state) and drives real router
// navigation, since useBlocker only works when mounted through a data router
// (createMemoryRouter/RouterProvider) — see App.test.tsx for the same pattern.
function Harness() {
  const [dirty, setDirty] = useState(false)
  const navigate = useNavigate()
  const { blocked, confirmLeave, cancelLeave } = useUnsavedChangesGuard(dirty)

  return (
    <div>
      <button onClick={() => setDirty(true)}>Make dirty</button>
      <button onClick={() => setDirty(false)}>Make clean</button>
      <button onClick={() => navigate('/other')}>Navigate away</button>
      {blocked && (
        <div role="dialog">
          <button onClick={confirmLeave}>Leave</button>
          <button onClick={cancelLeave}>Stay</button>
        </div>
      )}
    </div>
  )
}

function renderHarness() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Harness /> },
      { path: '/other', element: <p>Other page</p> },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('useUnsavedChangesGuard', () => {
  afterEach(() => cleanup())

  it('does not block navigation when isDirty is false', async () => {
    const user = userEvent.setup()
    renderHarness()

    await user.click(screen.getByRole('button', { name: 'Navigate away' }))

    expect(await screen.findByText('Other page')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('blocks navigation and exposes blocked=true when isDirty is true', async () => {
    const user = userEvent.setup()
    renderHarness()

    await user.click(screen.getByRole('button', { name: 'Make dirty' }))
    await user.click(screen.getByRole('button', { name: 'Navigate away' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText('Other page')).not.toBeInTheDocument()
  })

  it('confirmLeave proceeds with the blocked navigation', async () => {
    const user = userEvent.setup()
    renderHarness()

    await user.click(screen.getByRole('button', { name: 'Make dirty' }))
    await user.click(screen.getByRole('button', { name: 'Navigate away' }))
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Leave' }))

    expect(await screen.findByText('Other page')).toBeInTheDocument()
  })

  it('cancelLeave resets the blocker, keeps the current page, and still blocks the next attempt', async () => {
    const user = userEvent.setup()
    renderHarness()

    await user.click(screen.getByRole('button', { name: 'Make dirty' }))
    await user.click(screen.getByRole('button', { name: 'Navigate away' }))
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Stay' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Other page')).not.toBeInTheDocument()

    // Still dirty, so a second attempt must block again — proves cancelLeave
    // reset the blocker instead of leaving it permanently unblocked.
    await user.click(screen.getByRole('button', { name: 'Navigate away' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('adds a beforeunload listener while dirty and removes it when clean or unmounted', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const user = userEvent.setup()
    const { unmount } = renderHarness()

    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function))

    await user.click(screen.getByRole('button', { name: 'Make dirty' }))
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    await user.click(screen.getByRole('button', { name: 'Make clean' }))
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    removeSpy.mockClear()
    await user.click(screen.getByRole('button', { name: 'Make dirty' }))
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
