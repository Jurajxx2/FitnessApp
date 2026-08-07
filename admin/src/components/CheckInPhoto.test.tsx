import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { CheckInPhoto } from './CheckInPhoto'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}))
vi.mock('../lib/storage', () => ({ signedCheckInPhotoUrl: vi.fn() }))

describe('CheckInPhoto', () => {
  afterEach(() => cleanup())

  it('renders null while the signed URL is unresolved', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined } as any)
    const { container } = render(<CheckInPhoto path="u1/checkin_front.jpg" alt="Fotka spredu" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders an img with the resolved src and given alt once resolved', () => {
    vi.mocked(useQuery).mockReturnValue({ data: 'https://example.com/signed.jpg' } as any)
    render(<CheckInPhoto path="u1/checkin_front.jpg" alt="Fotka spredu" className="h-40 w-30 rounded-lg object-cover" />)
    const img = screen.getByAltText('Fotka spredu') as HTMLImageElement
    expect(img.src).toBe('https://example.com/signed.jpg')
    expect(img.className).toBe('h-40 w-30 rounded-lg object-cover')
  })
})
