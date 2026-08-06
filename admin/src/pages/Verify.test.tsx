import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Verify, { copy } from './Verify'

const { mockVerifyOtp, mockSingle, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn(() => ({ single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
  return { mockVerifyOtp: vi.fn(), mockSingle, mockEq, mockSelect, mockFrom }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { verifyOtp: mockVerifyOtp },
    from: mockFrom,
  },
}))

function renderVerify(email = 'admin@example.com') {
  sessionStorage.setItem('otp-email', email)
  return render(
    <MemoryRouter initialEntries={['/login/verify']}>
      <Routes>
        <Route path="/login/verify" element={<Verify />} />
        <Route path="/login/otp" element={<div>OTP login page</div>} />
        <Route path="/admin" element={<div>Admin dashboard</div>} />
        <Route path="/nutrition" element={<div>Trainee workspace</div>} />
      </Routes>
    </MemoryRouter>
  )
}

async function enterCode(code = '123456') {
  const inputs = screen.getAllByRole('textbox')
  for (let i = 0; i < 6; i++) {
    await userEvent.type(inputs[i], code[i])
  }
}

describe('Verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('redirects to the OTP email page when no email is stored', () => {
    render(
      <MemoryRouter initialEntries={['/login/verify']}>
        <Routes>
          <Route path="/login/verify" element={<Verify />} />
          <Route path="/login/otp" element={<div>OTP login page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('OTP login page')).toBeInTheDocument()
  })

  it('keeps the submit button disabled until all 6 digits are entered', async () => {
    renderVerify()
    const button = screen.getByRole('button', { name: /verify code/i })
    expect(button).toBeDisabled()

    const inputs = screen.getAllByRole('textbox')
    await userEvent.type(inputs[0], '1')
    expect(button).toBeDisabled()

    for (let i = 1; i < 6; i++) await userEvent.type(inputs[i], String(i + 1))
    expect(button).not.toBeDisabled()
  })

  it('shows error and clears loading when verifyOtp returns an error', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { user: null }, error: { message: 'Token has expired or is invalid' } })
    renderVerify()

    await enterCode()
    await userEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() =>
      expect(screen.getByText('Token has expired or is invalid')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /verify code/i })).not.toBeDisabled()
  })

  it('shows error and clears loading when verifyOtp returns no user', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { user: null }, error: null })
    renderVerify()

    await enterCode()
    await userEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() =>
      expect(screen.getByText('Verification failed: No user returned')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /verify code/i })).not.toBeDisabled()
  })

  it('navigates to /admin when verified user is an admin', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockSingle.mockResolvedValue({ data: { is_admin: true }, error: null })
    renderVerify()

    await enterCode()
    await userEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() =>
      expect(screen.getByText('Admin dashboard')).toBeInTheDocument()
    )
  })

  it('navigates to the trainee workspace when verified user is not an admin', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockSingle.mockResolvedValue({ data: { is_admin: false }, error: null })
    renderVerify()

    await enterCode()
    await userEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() =>
      expect(screen.getByText('Trainee workspace')).toBeInTheDocument()
    )
  })

  it('fails closed to the trainee workspace when profile fetch fails', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockSingle.mockResolvedValue({ data: null, error: { message: 'row not found' } })
    renderVerify()

    await enterCode()
    await userEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() =>
      expect(screen.getByText('Trainee workspace')).toBeInTheDocument()
    )
  })

  it('shows error and clears loading on unexpected thrown exception', async () => {
    mockVerifyOtp.mockRejectedValue(new Error('Network failure'))
    renderVerify()

    await enterCode()
    await userEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() =>
      expect(screen.getByText('Network failure')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /verify code/i })).not.toBeDisabled()
  })

  it('removes otp-email from sessionStorage after successful verification', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockSingle.mockResolvedValue({ data: { is_admin: true }, error: null })
    renderVerify()

    await enterCode()
    await userEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() => expect(screen.getByText('Admin dashboard')).toBeInTheDocument())
    expect(sessionStorage.getItem('otp-email')).toBeNull()
  })

  it('exposes the same key set in the sk and cs copy objects', () => {
    expect(Object.keys(copy.sk).sort()).toEqual(Object.keys(copy.cs).sort())
  })
})
