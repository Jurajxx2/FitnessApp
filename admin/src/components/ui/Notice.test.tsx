import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoticeProvider, useNotice } from './Notice'

function Trigger() {
  const { notify } = useNotice()
  return <button onClick={() => notify('Uložené', 'success')}>Notify</button>
}

describe('Notice', () => {
  it('clears the mobile bottom nav with a safe-area-aware offset and resets it back to bottom-4 on desktop', async () => {
    render(
      <NoticeProvider>
        <Trigger />
      </NoticeProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Notify' }))

    const status = await screen.findByRole('status')
    const container = status.parentElement as HTMLElement
    expect(container.className).toContain('bottom-[calc(5rem+env(safe-area-inset-bottom))]')
    expect(container.className).toContain('md:bottom-4')
  })

  it('renders the Slovak dismiss aria-label', async () => {
    render(
      <NoticeProvider>
        <Trigger />
      </NoticeProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Notify' }))

    expect(await screen.findByRole('button', { name: 'Zavrieť upozornenie' })).toBeInTheDocument()
  })
})
