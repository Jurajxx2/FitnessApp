import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MfaChallenge from './MfaChallenge'

const { mockListFactors, mockChallengeAndVerify, mockRefreshSession, mockUseAuth } = vi.hoisted(() => ({
  mockListFactors: vi.fn(),
  mockChallengeAndVerify: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockUseAuth: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({ useAuth: mockUseAuth }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      mfa: { listFactors: mockListFactors, challengeAndVerify: mockChallengeAndVerify },
      refreshSession: mockRefreshSession,
      signOut: vi.fn(),
    },
  },
}))

describe('MfaChallenge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ session: {}, profile: {}, isAdmin: true, assuranceLevel: 'aal1', isLoading: false })
    mockListFactors.mockResolvedValue({
      data: { all: [{ id: 'factor-1', factor_type: 'totp', status: 'verified', friendly_name: 'Primary' }] },
      error: null,
    })
    mockChallengeAndVerify.mockResolvedValue({ data: {}, error: null })
    mockRefreshSession.mockResolvedValue({ data: {}, error: null })
  })

  it('challenges a verified factor and returns to the requested admin page', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/login/mfa?returnTo=%2Fadmin%2Fusers']}>
        <Routes>
          <Route path="/login/mfa" element={<MfaChallenge />} />
          <Route path="/admin/users" element={<div>Admin users</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.type(await screen.findByLabelText('Six-digit code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }))

    await waitFor(() => expect(mockChallengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' }))
    expect(mockRefreshSession).toHaveBeenCalled()
    expect(await screen.findByText('Admin users')).toBeInTheDocument()
  })
})
