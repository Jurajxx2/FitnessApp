import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import {
  readUserDeletion,
  startOrAdvanceUserDeletion,
} from './deletion-service.ts'

const job = {
  id: 'job-1',
  target_user_id: '550e8400-e29b-41d4-a716-446655440000',
  requested_by: '550e8400-e29b-41d4-a716-446655440001',
  status: 'manual_review',
  lease_token: null,
  last_error_code: 'off_prefix_storage_objects',
}

Deno.test('manual-review delete explicitly rechecks and remains paused while the blocker exists', async () => {
  const calls: string[] = []
  const client = {
    rpc(name: string) {
      calls.push(name)
      return Promise.resolve({ data: job, error: null })
    },
  } as unknown as SupabaseClient

  const result = await startOrAdvanceUserDeletion(
    client,
    job.target_user_id,
    job.requested_by,
  )

  assertEquals(calls, [
    'admin_begin_user_deletion',
    'admin_recheck_user_deletion_manual_review',
  ])
  assertEquals(result, {
    ok: true,
    httpStatus: 202,
    deletion: {
      jobId: job.id,
      status: 'manual_review',
      completed: false,
      retryable: false,
      errorCode: 'off_prefix_storage_objects',
    },
  })
})

Deno.test('every shared-content manual-review code pauses without claiming a lease', async () => {
  // Scope: this pins the service's GENERIC manual-review handling only. The
  // code is an opaque passthrough string — the branch is on status — so this
  // test would pass for any value. The actual classification is proven by
  // supabase/verification/user_deletion_jobs.sql.
  for (
    const errorCode of ['shared_direct_content', 'shared_authored_content']
  ) {
    const paused = { ...job, last_error_code: errorCode }
    const calls: string[] = []
    const client = {
      rpc(name: string) {
        calls.push(name)
        return Promise.resolve({ data: paused, error: null })
      },
    } as unknown as SupabaseClient

    const result = await startOrAdvanceUserDeletion(
      client,
      paused.target_user_id,
      paused.requested_by,
    )

    assertEquals(calls, [
      'admin_begin_user_deletion',
      'admin_recheck_user_deletion_manual_review',
    ], errorCode)
    assertEquals(result, {
      ok: true,
      httpStatus: 202,
      deletion: {
        jobId: paused.id,
        status: 'manual_review',
        completed: false,
        retryable: false,
        errorCode,
      },
    }, errorCode)
  }
})

Deno.test('manual-review recheck failure preserves the durable job id for terminal audit', async () => {
  let call = 0
  const client = {
    rpc() {
      call += 1
      return call === 1
        ? Promise.resolve({ data: job, error: null })
        : Promise.resolve({ data: null, error: { code: 'recheck_failed' } })
    },
  } as unknown as SupabaseClient

  const result = await startOrAdvanceUserDeletion(
    client,
    job.target_user_id,
    job.requested_by,
  )

  assertEquals(result, {
    ok: false,
    httpStatus: 500,
    jobId: job.id,
    errorCode: 'recheck_failed',
  })
})

Deno.test('duplicate request replay reads durable state without advancing the worker', async () => {
  const calls: string[] = []
  const builder = {
    select() {
      calls.push('select')
      return builder
    },
    eq() {
      calls.push('eq')
      return builder
    },
    maybeSingle() {
      calls.push('maybeSingle')
      return Promise.resolve({ data: job, error: null })
    },
  }
  const client = {
    from() {
      calls.push('from')
      return builder
    },
    rpc() {
      throw new Error('replay must not call a mutation RPC')
    },
  } as unknown as SupabaseClient

  const result = await readUserDeletion(client, job.target_user_id)

  assertEquals(calls, ['from', 'select', 'eq', 'maybeSingle'])
  assertEquals(result.deletion?.jobId, job.id)
  assertEquals(result.deletion?.status, 'manual_review')
})

Deno.test('concurrent duplicate before begin remains pending without inventing a durable job', async () => {
  const builder = {
    select() {
      return builder
    },
    eq() {
      return builder
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null })
    },
  }
  const client = { from: () => builder } as unknown as SupabaseClient

  const result = await readUserDeletion(client, job.target_user_id)

  assertEquals(result, {
    ok: false,
    httpStatus: 202,
    jobId: job.target_user_id,
    errorCode: 'deletion_job_pending',
  })
})
