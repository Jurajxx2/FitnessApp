import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminMfa from './AdminMfa'

const {
  mockListFactors,
  mockEnroll,
  mockChallenge,
  mockVerify,
  mockUnenroll,
  mockRefreshAssurance,
  assuranceState,
} = vi.hoisted(() => ({
  mockListFactors: vi.fn(),
  mockEnroll: vi.fn(),
  mockChallenge: vi.fn(),
  mockVerify: vi.fn(),
  mockUnenroll: vi.fn(),
  mockRefreshAssurance: vi.fn(),
  assuranceState: {
    currentLevel: 'aal1' as 'aal1' | 'aal2' | null,
    nextLevel: 'aal2' as 'aal1' | 'aal2' | null,
    error: null as Error | null,
    isLoading: false,
  },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuthAssurance: () => ({ ...assuranceState, refreshAssuranceLevel: mockRefreshAssurance }),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: mockListFactors,
        enroll: mockEnroll,
        challenge: mockChallenge,
        verify: mockVerify,
        unenroll: mockUnenroll,
      },
    },
  },
}))

const verifiedFactor = {
  id: 'factor-1',
  friendly_name: 'Primary phone',
  factor_type: 'totp',
  status: 'verified',
  created_at: '2026-08-11T10:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/mfa']}>
      <Routes>
        <Route path="/admin/mfa" element={<AdminMfa />} />
        <Route path="/admin" element={<div>Admin dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminMfa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assuranceState.currentLevel = 'aal1'
    assuranceState.nextLevel = 'aal2'
    assuranceState.error = null
    assuranceState.isLoading = false
    mockListFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null })
    mockRefreshAssurance.mockResolvedValue({ currentLevel: 'aal2', nextLevel: 'aal2', error: null, isLoading: false })
    mockChallenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    mockVerify.mockResolvedValue({ data: {}, error: null })
    mockUnenroll.mockResolvedValue({ data: {}, error: null })
  })

  it('enrolls a TOTP factor and verifies it through challenge and verify', async () => {
    const user = userEvent.setup()
    mockEnroll.mockResolvedValue({
      data: { id: 'new-factor', totp: { qr_code: '<svg></svg>', secret: 'SETUP-SECRET' } },
      error: null,
    })
    mockListFactors
      .mockResolvedValueOnce({ data: { all: [], totp: [] }, error: null })
      .mockResolvedValue({
        data: { all: [{ ...verifiedFactor, id: 'new-factor', status: 'unverified' }], totp: [] },
        error: null,
      })
    renderPage()

    await user.clear(await screen.findByLabelText('Device name'))
    await user.type(screen.getByLabelText('Device name'), 'Office authenticator')
    await user.click(screen.getByRole('button', { name: /add authenticator/i }))

    expect(mockEnroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Office authenticator' })
    expect(await screen.findByAltText('Authenticator enrollment QR code')).toBeInTheDocument()
    expect(screen.getByText('SETUP-SECRET')).toBeInTheDocument()

    await user.type(screen.getByLabelText('6-digit code'), '123456')
    await user.click(screen.getByRole('button', { name: /verify and enable/i }))

    await waitFor(() => expect(mockChallenge).toHaveBeenCalledWith({ factorId: 'new-factor' }))
    expect(mockVerify).toHaveBeenCalledWith({ factorId: 'new-factor', challengeId: 'challenge-1', code: '123456' })
    expect(mockRefreshAssurance).toHaveBeenCalled()
    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument()
  })

  it('challenges an existing verified factor before admin access', async () => {
    const user = userEvent.setup()
    mockListFactors.mockResolvedValue({ data: { all: [verifiedFactor], totp: [verifiedFactor] }, error: null })
    renderPage()

    await user.type(await screen.findByLabelText('6-digit code'), '654321')
    await user.click(screen.getByRole('button', { name: /verify and continue/i }))

    await waitFor(() => expect(mockChallenge).toHaveBeenCalledWith({ factorId: 'factor-1' }))
    expect(mockVerify).toHaveBeenCalledWith({ factorId: 'factor-1', challengeId: 'challenge-1', code: '654321' })
    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument()
  })

  it('shows verification errors without opening admin content', async () => {
    const user = userEvent.setup()
    mockListFactors.mockResolvedValue({ data: { all: [verifiedFactor], totp: [verifiedFactor] }, error: null })
    mockVerify.mockResolvedValue({ data: null, error: new Error('Invalid TOTP code') })
    renderPage()

    await user.type(await screen.findByLabelText('6-digit code'), '111111')
    await user.click(screen.getByRole('button', { name: /verify and continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid TOTP code')
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument()
  })

  it('never lets the browser remove verified factors, even when two are present', async () => {
    assuranceState.currentLevel = 'aal2'
    const backup = { ...verifiedFactor, id: 'factor-2', friendly_name: 'Backup tablet' }
    mockListFactors.mockResolvedValue({ data: { all: [verifiedFactor, backup], totp: [verifiedFactor, backup] }, error: null })
    renderPage()

    expect(await screen.findByRole('button', { name: 'Remove Backup tablet' })).toBeDisabled()
    expect(await screen.findByRole('button', { name: 'Remove Primary phone' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Open the protected recovery instructions' })).toHaveAttribute('href', '/admin/mfa/recovery')
    expect(mockUnenroll).not.toHaveBeenCalled()
  })

  it('allows the browser to remove only an incomplete enrollment factor', async () => {
    const user = userEvent.setup()
    const incomplete = { ...verifiedFactor, id: 'incomplete-factor', friendly_name: 'Abandoned setup', status: 'unverified' }
    mockListFactors
      .mockResolvedValueOnce({ data: { all: [incomplete], totp: [] }, error: null })
      .mockResolvedValueOnce({ data: { all: [incomplete], totp: [] }, error: null })
      .mockResolvedValue({ data: { all: [], totp: [] }, error: null })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove Abandoned setup' }))
    await waitFor(() => expect(mockUnenroll).toHaveBeenCalledWith({ factorId: 'incomplete-factor' }))
    expect(mockRefreshAssurance).not.toHaveBeenCalled()
  })

  it('rechecks an incomplete factor and refuses removal if another tab verified it', async () => {
    const user = userEvent.setup()
    const incomplete = { ...verifiedFactor, id: 'factor-race', friendly_name: 'Other tab setup', status: 'unverified' }
    const nowVerified = { ...incomplete, status: 'verified' }
    mockListFactors
      .mockResolvedValueOnce({ data: { all: [incomplete], totp: [] }, error: null })
      .mockResolvedValueOnce({ data: { all: [nowVerified], totp: [nowVerified] }, error: null })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove Other tab setup' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Verified authenticators can only be removed')
    expect(mockUnenroll).not.toHaveBeenCalled()
  })

  it('refuses removal when the refreshed factor is no longer an incomplete TOTP enrollment', async () => {
    const user = userEvent.setup()
    const incomplete = { ...verifiedFactor, id: 'factor-changed', friendly_name: 'Changed setup', status: 'unverified' }
    const changedType = { ...incomplete, factor_type: 'phone' }
    mockListFactors
      .mockResolvedValueOnce({ data: { all: [incomplete], totp: [] }, error: null })
      .mockResolvedValueOnce({ data: { all: [changedType], totp: [] }, error: null })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove Changed setup' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('protected operator recovery procedure')
    expect(mockUnenroll).not.toHaveBeenCalled()
  })

  it('keeps every factor action unavailable until a failed list request is retried successfully', async () => {
    const user = userEvent.setup()
    mockListFactors
      .mockResolvedValueOnce({ data: null, error: new Error('Factor service unavailable') })
      .mockResolvedValue({ data: { all: [], totp: [] }, error: null })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Authenticators unavailable' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Factor service unavailable')
    expect(screen.queryByRole('button', { name: /add authenticator/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('6-digit code')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry factor list' }))
    expect(await screen.findByRole('button', { name: /add authenticator/i })).toBeInTheDocument()
  })

  it('fails closed with a retry when AAL resolution errors', async () => {
    assuranceState.currentLevel = null
    assuranceState.nextLevel = null
    assuranceState.error = new Error('AAL unavailable')
    renderPage()

    expect(screen.getByRole('heading', { name: 'Security check unavailable' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('AAL unavailable')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mockRefreshAssurance).toHaveBeenCalled()
  })
})
