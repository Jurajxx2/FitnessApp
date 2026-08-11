import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CheckInForm from './CheckInForm'

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }))

vi.mock('../../checkins/hooks', () => ({
  useCurrentCheckIn: () => ({
    data: null,
    error: null,
    isFetched: true,
    isLoading: false,
  }),
  useSaveCheckIn: () => ({
    mutateAsync: mocks.mutateAsync,
    error: null,
    isPending: false,
  }),
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ profile: { weight_kg: 82 } }) }))

describe('CheckInForm photo behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mutateAsync.mockResolvedValue({ id: 'check-in-1' })
  })

  it('keeps a selected photo local until the form is submitted', async () => {
    const { container } = render(<MemoryRouter><CheckInForm /></MemoryRouter>)
    await screen.findByRole('heading', { name: 'Týždenný check-in' })
    const front = new File(['front'], 'front.png', { type: 'image/png' })
    const input = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[0]

    fireEvent.change(input, { target: { files: [front] } })

    expect(mocks.mutateAsync).not.toHaveBeenCalled()
    expect(screen.getByText('Fotky sa nahrajú až po odoslaní check-inu.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Odoslať check-in' }))

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      photoFiles: { front },
    })))
  })

  it('creates no side effect when a photo selection is abandoned', async () => {
    const { container, unmount } = render(<MemoryRouter><CheckInForm /></MemoryRouter>)
    await screen.findByRole('heading', { name: 'Týždenný check-in' })
    const input = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1]

    fireEvent.change(input, {
      target: { files: [new File(['side'], 'side.webp', { type: 'image/webp' })] },
    })
    unmount()

    expect(mocks.mutateAsync).not.toHaveBeenCalled()
  })
})
