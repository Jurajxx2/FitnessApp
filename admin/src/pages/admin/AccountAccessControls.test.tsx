import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AccountAccessControls, type AccountAction } from './UserDetail'

describe('AccountAccessControls', () => {
  const cases: Array<{ button: string; dialog: string; confirm: string; action: AccountAction; blocked?: boolean }> = [
    { button: 'Disable account', dialog: 'Disable this account?', confirm: 'Disable account', action: 'block' },
    { button: 'Activate account', dialog: 'Activate this account?', confirm: 'Activate account', action: 'unblock', blocked: true },
    { button: 'Make user an admin', dialog: 'Grant admin access?', confirm: 'Make admin', action: 'promote_admin' },
    { button: 'Delete user', dialog: 'Permanently delete this user?', confirm: 'Delete user', action: 'delete' },
  ]

  for (const testCase of cases) {
    it(`requires confirmation before ${testCase.action}`, async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      render(<AccountAccessControls userName="Jane Athlete" isBlocked={testCase.blocked ?? false} pending={false} onConfirm={onConfirm} />)
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: testCase.button }))
      expect(onConfirm).not.toHaveBeenCalled()
      const dialog = screen.getByRole('dialog', { name: testCase.dialog })
      expect(dialog).toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: testCase.confirm }))
      await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(testCase.action))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  }
})
