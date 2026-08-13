import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import {
  advanceDeletionJob,
  type DeletionJob,
  type DeletionStatus,
} from './deletion.ts'
import {
  createDeletionAuth,
  createDeletionRepository,
  createDeletionStorage,
} from './deletion-adapters.ts'

export interface DeletionServiceResult {
  ok: boolean
  httpStatus: number
  jobId?: string
  errorCode?: string
  deletion?: {
    jobId: string
    status: DeletionStatus
    completed: boolean
    retryable: boolean
    errorCode?: string
  }
}

function deletionJob(data: unknown): DeletionJob | null {
  const candidate = Array.isArray(data) ? data[0] : data
  if (!candidate || typeof candidate !== 'object') return null
  const job = candidate as Partial<DeletionJob>
  if (
    typeof job.id !== 'string' ||
    typeof job.target_user_id !== 'string' ||
    typeof job.requested_by !== 'string' ||
    typeof job.status !== 'string'
  ) return null
  return job as DeletionJob
}

function resultForJob(job: DeletionJob): DeletionServiceResult {
  return {
    ok: true,
    httpStatus: job.status === 'completed' ? 200 : 202,
    deletion: {
      jobId: job.id,
      status: job.status,
      completed: job.status === 'completed',
      retryable: job.status !== 'completed' && job.status !== 'manual_review',
      errorCode: job.last_error_code ?? undefined,
    },
  }
}

/** Read-only replay for a duplicate request id; never advances the worker. */
export async function readUserDeletion(
  client: SupabaseClient,
  targetUserId: string,
): Promise<DeletionServiceResult> {
  const { data, error } = await client
    .from('user_deletion_jobs')
    .select(
      'id, target_user_id, requested_by, status, lease_token, last_error_code, last_error_message',
    )
    .eq('target_user_id', targetUserId)
    .maybeSingle()
  if (error) {
    return {
      ok: false,
      httpStatus: 500,
      jobId: targetUserId,
      errorCode: 'deletion_replay_failed',
    }
  }
  const job = deletionJob(data)
  if (job) return resultForJob(job)

  // A concurrent original invocation may have persisted its attempt but not
  // reached the atomic begin RPC yet. Do not synthesize a successful durable
  // job response: the original attempt may still fail before creating it.
  return {
    ok: false,
    httpStatus: 202,
    jobId: targetUserId,
    errorCode: 'deletion_job_pending',
  }
}

export async function startOrAdvanceUserDeletion(
  client: SupabaseClient,
  targetUserId: string,
  requestedBy: string,
): Promise<DeletionServiceResult> {
  const { data: beginData, error: beginError } = await client.rpc(
    'admin_begin_user_deletion',
    { p_target_user_id: targetUserId, p_requested_by: requestedBy },
  )
  if (beginError) {
    return {
      ok: false,
      httpStatus: beginError.code === 'P0002'
        ? 404
        : beginError.code === '23514'
        ? 409
        : 500,
      errorCode: beginError.code ?? 'begin_deletion_failed',
    }
  }

  let job = deletionJob(beginData)
  if (!job) {
    return { ok: false, httpStatus: 500, errorCode: 'invalid_job_response' }
  }
  if (job.status === 'manual_review') {
    const manualJobId = job.id
    const { data: recheckData, error: recheckError } = await client.rpc(
      'admin_recheck_user_deletion_manual_review',
      { p_job_id: job.id },
    )
    if (recheckError) {
      return {
        ok: false,
        httpStatus: 500,
        jobId: manualJobId,
        errorCode: recheckError.code ?? 'manual_review_recheck_failed',
      }
    }
    job = deletionJob(recheckData)
    if (!job) {
      return {
        ok: false,
        httpStatus: 500,
        jobId: manualJobId,
        errorCode: 'invalid_job_response',
      }
    }
  }
  if (job.status === 'manual_review' || job.status === 'completed') {
    return resultForJob(job)
  }

  const { data: claimData, error: claimError } = await client.rpc(
    'admin_claim_user_deletion',
    { p_job_id: job.id, p_lease_seconds: 120 },
  )
  if (claimError) {
    return {
      ok: false,
      httpStatus: 500,
      jobId: job.id,
      errorCode: claimError.code ?? 'claim_deletion_failed',
    }
  }

  const claimed = deletionJob(claimData)
  if (!claimed) {
    return {
      ok: true,
      httpStatus: 202,
      deletion: {
        jobId: job.id,
        status: job.status,
        completed: false,
        retryable: true,
      },
    }
  }

  const result = await advanceDeletionJob(
    claimed,
    createDeletionRepository(client),
    createDeletionStorage(client),
    createDeletionAuth(client),
  )
  return {
    ok: true,
    httpStatus: result.completed ? 200 : 202,
    deletion: { jobId: job.id, ...result },
  }
}
