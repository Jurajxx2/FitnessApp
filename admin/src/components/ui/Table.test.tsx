import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { ClickableRow } from './Table'

describe('ClickableRow', () => {
  it('opens from row click and keyboard activation', async () => {
    const activate = vi.fn()
    const user = userEvent.setup()
    render(<table><tbody><ClickableRow label="Open athlete" onActivate={activate}><td>Athlete</td></ClickableRow></tbody></table>)

    const row = screen.getByLabelText('Open athlete')
    await user.click(row)
    row.focus()
    await user.keyboard('{Enter}')

    expect(activate).toHaveBeenCalledTimes(2)
  })

  it('does not activate the row when an action button is clicked', async () => {
    const activate = vi.fn()
    const action = vi.fn()
    const user = userEvent.setup()
    render(<table><tbody><ClickableRow label="Open athlete" onActivate={activate}><td><Button onClick={action}>Delete</Button></td></ClickableRow></tbody></table>)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(action).toHaveBeenCalledOnce()
    expect(activate).not.toHaveBeenCalled()
  })
})
