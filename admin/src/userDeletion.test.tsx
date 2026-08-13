import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  DeletionJobCard,
  DeletionRequestIdStore,
  deletionIsComplete,
  isDefinitiveDeletionError,
  type UserDeletionJob,
} from './userDeletion'

const job: UserDeletionJob = {
  id: 'job-1',
  target_user_id: '550e8400-e29b-41d4-a716-446655440000',
  requested_by: '550e8400-e29b-41d4-a716-446655440001',
  status: 'retryable_error',
  attempt_count: 2,
  removed_object_count: 101,
  last_error_code: 'storage_remove_failed',
  last_error_message: 'Storage object deletion failed',
  updated_at: '2026-08-11T20:00:00Z',
}

describe('DeletionJobCard', () => {
  it('keeps retryable deletion state visible and retries the same target', async () => {
    const retry = vi.fn().mockResolvedValue(undefined)
    render(<DeletionJobCard job={job} onRetry={retry} />)

    expect(screen.getByText('Needs retry')).toBeInTheDocument()
    expect(screen.getByText(/101 storage objects removed/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry deletion' }))
    expect(retry).toHaveBeenCalledWith(job.target_user_id)
  })

  it('offers an explicit operator recheck for manual-review jobs', async () => {
    const recheck = vi.fn().mockResolvedValue(undefined)
    render(<DeletionJobCard job={{ ...job, status: 'manual_review' }} onRetry={recheck} />)

    expect(screen.getByText('Manual review required')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Recheck deletion' }))
    expect(recheck).toHaveBeenCalledWith(job.target_user_id)
  })

  // The card has no error-code lookup table and never reads last_error_code:
  // every manual-review reason reaches the operator verbatim through the
  // durable last_error_message the RPC wrote. This pins that passthrough only —
  // which reason codes the database produces is proven by
  // supabase/verification/user_deletion_jobs.sql.
  it.each([
    ['Target directly owns content assigned to another user.'],
    ["Target authored coach feedback on another user's training log."],
  ])('passes the manual-review reason %s through to the operator', (message) => {
    render(
      <DeletionJobCard
        job={{ ...job, status: 'manual_review', last_error_message: message }}
      />,
    )

    expect(screen.getByText('Manual review required')).toBeInTheDocument()
    expect(screen.getByText(message)).toBeInTheDocument()
  })
})

describe('deletion completion navigation gate', () => {
  it('keeps the user detail open for every incomplete 202 response', () => {
    expect(deletionIsComplete({ deletion: { completed: false } })).toBe(false)
    expect(deletionIsComplete({})).toBe(false)
  })

  it('allows navigation only after the durable job reports completed', () => {
    expect(deletionIsComplete({ deletion: { completed: true } })).toBe(true)
  })
})

describe('DeletionRequestIdStore', () => {
  it('reuses an id across ambiguous retries and rotates after a definitive response', () => {
    const ids = new DeletionRequestIdStore()
    const first = ids.idFor(job.target_user_id)

    expect(ids.idFor(job.target_user_id)).toBe(first)
    ids.complete(job.target_user_id)
    expect(ids.idFor(job.target_user_id)).not.toBe(first)
  })

  it('retains only network and timeout ambiguity, including after audited 500 responses', () => {
    expect(isDefinitiveDeletionError()).toBe(false)
    expect(isDefinitiveDeletionError(new Response(null, { status: 408 }))).toBe(false)
    expect(isDefinitiveDeletionError(new Response(null, { status: 202 }))).toBe(true)
    expect(isDefinitiveDeletionError(new Response(null, { status: 409 }))).toBe(true)
    expect(isDefinitiveDeletionError(new Response(null, { status: 500 }))).toBe(true)
  })
})
