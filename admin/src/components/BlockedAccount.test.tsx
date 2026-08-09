import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { BlockedAccount } from './BlockedAccount'

const { mockSignOut } = vi.hoisted(() => ({ mockSignOut: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: mockSignOut } } }))

beforeEach(() => {
  mockSignOut.mockReset()
  mockSignOut.mockResolvedValue({ error: null })
})

it('renders the Slovak blocked-account copy', () => {
  render(<BlockedAccount />)

  expect(screen.getByRole('heading', { name: 'Prístup k účtu je zablokovaný' })).toBeInTheDocument()
  expect(screen.getByText('Tento účet nemá prístup k údajom Coach Foška. Ak si myslíš, že ide o omyl, kontaktuj svoju trénerku.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Odhlásiť sa' })).toBeInTheDocument()
})

it('signs the user out when the Slovak sign-out button is clicked', async () => {
  render(<BlockedAccount />)

  await userEvent.click(screen.getByRole('button', { name: 'Odhlásiť sa' }))

  expect(mockSignOut).toHaveBeenCalledOnce()
})
