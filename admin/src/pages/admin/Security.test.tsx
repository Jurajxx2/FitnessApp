import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Security from './Security'

const { mockListFactors, mockEnroll, mockChallengeAndVerify, mockRefreshSession, mockUnenroll, mockUseAuth } = vi.hoisted(() => ({
  mockListFactors: vi.fn(),
  mockEnroll: vi.fn(),
  mockChallengeAndVerify: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockUnenroll: vi.fn(),
  mockUseAuth: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({ useAuth: mockUseAuth }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: mockListFactors,
        enroll: mockEnroll,
        challengeAndVerify: mockChallengeAndVerify,
        unenroll: mockUnenroll,
      },
      refreshSession: mockRefreshSession,
    },
  },
}))

describe('Admin Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ assuranceLevel: 'aal1' })
    mockListFactors.mockResolvedValue({ data: { all: [] }, error: null })
    mockEnroll.mockResolvedValue({
      data: { id: 'new-factor', totp: { qr_code: '<svg></svg>', secret: 'SECRET123' } },
      error: null,
    })
    mockChallengeAndVerify.mockResolvedValue({ data: {}, error: null })
    mockRefreshSession.mockResolvedValue({ data: {}, error: null })
    mockUnenroll.mockResolvedValue({ data: {}, error: null })
  })

  it('enrolls and verifies a TOTP authenticator before entering admin tools', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin/security?returnTo=%2Fadmin']}>
        <Routes>
          <Route path="/admin/security" element={<Security />} />
          <Route path="/admin" element={<div>Admin dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Add authenticator' }))
    expect(await screen.findByAltText('Authenticator enrollment QR code')).toBeInTheDocument()
    expect(screen.getByText('SECRET123')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Six-digit code'), '654321')
    await user.click(screen.getByRole('button', { name: 'Verify authenticator' }))

    await waitFor(() => expect(mockChallengeAndVerify).toHaveBeenCalledWith({ factorId: 'new-factor', code: '654321' }))
    expect(mockRefreshSession).toHaveBeenCalled()
    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument()
  })
})
