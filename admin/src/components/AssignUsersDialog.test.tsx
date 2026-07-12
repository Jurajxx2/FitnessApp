import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AssignUsersDialog } from './AssignUsersDialog'

const profiles = [
  { id: 'a', full_name: 'Assignable Unassigned', email: 'a@x.com', is_admin: false, is_blocked: false },
  { id: 'b', full_name: 'Assigned Athlete', email: 'b@x.com', is_admin: false, is_blocked: false },
  { id: 'c', full_name: 'Blocked Assigned', email: 'c@x.com', is_admin: false, is_blocked: true },
  { id: 'd', full_name: 'Blocked Unassigned', email: 'd@x.com', is_admin: false, is_blocked: true },
  { id: 'e', full_name: 'Coach Admin', email: 'e@x.com', is_admin: true, is_blocked: false },
]

function renderDialog(value: string[] = ['b', 'c']) {
  const onChange = vi.fn()
  const onClose = vi.fn()
  render(
    <AssignUsersDialog open onClose={onClose} profiles={profiles} value={value} onChange={onChange} />
  )
  return { onChange, onClose }
}

describe('AssignUsersDialog', () => {
  afterEach(() => cleanup())

  it('renders assignable athletes and assigned-then-blocked users, but hides blocked/admin who were never assigned', () => {
    renderDialog()
    expect(screen.getByText('Assignable Unassigned')).toBeDefined()
    expect(screen.getByText('Assigned Athlete')).toBeDefined()
    // Assigned BEFORE being blocked → still visible so the coach can remove them.
    expect(screen.getByText('Blocked Assigned')).toBeDefined()
    // Never assigned + blocked/admin → cannot be newly assigned, so not shown.
    expect(screen.queryByText('Blocked Unassigned')).toBeNull()
    expect(screen.queryByText('Coach Admin')).toBeNull()
  })

  it('footer count matches the assigned users (including the blocked-assigned one)', () => {
    renderDialog()
    expect(screen.getByText('2 assigned')).toBeDefined()
  })

  it('marks the assigned-but-blocked row with a Blocked indicator', () => {
    renderDialog()
    expect(screen.getByText('Blocked')).toBeDefined()
  })

  it('lets the coach remove a blocked-but-assigned athlete and reports the removal on Done', () => {
    const { onChange } = renderDialog()
    fireEvent.click(screen.getByText('Blocked Assigned'))
    // After removal the now blocked-unassigned user disappears and the count drops.
    expect(screen.getByText('1 assigned')).toBeDefined()
    expect(screen.queryByText('Blocked Assigned')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onChange).toHaveBeenCalledWith(['b'])
  })

  it('assigns an assignable athlete and reports it on Done', () => {
    const { onChange } = renderDialog()
    fireEvent.click(screen.getByText('Assignable Unassigned'))
    expect(screen.getByText('3 assigned')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    const calls = onChange.mock.calls
    const ids = calls[calls.length - 1][0] as string[]
    expect(ids).toHaveLength(3)
    expect(ids).toEqual(expect.arrayContaining(['a', 'b', 'c']))
  })

  it('"Assigned only" filter still shows an assigned-but-blocked user', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Assigned only' }))
    expect(screen.getByText('Blocked Assigned')).toBeDefined()
    expect(screen.getByText('Assigned Athlete')).toBeDefined()
    expect(screen.queryByText('Assignable Unassigned')).toBeNull()
  })
})
