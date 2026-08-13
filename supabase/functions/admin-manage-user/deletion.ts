export const DELETION_BUCKETS = [
  'chat-images',
  'check-in-photos',
  'meal-photos',
] as const

export type DeletionBucket = typeof DELETION_BUCKETS[number]
export type DeletionStage = 'cleaning_storage' | 'deleting_auth'
export type DeletionStatus =
  | 'requested'
  | DeletionStage
  | 'retryable_error'
  | 'manual_review'
  | 'completed'

export interface DeletionJob {
  id: string
  target_user_id: string
  requested_by: string
  status: DeletionStatus
  lease_token: string | null
  last_error_code?: string | null
  last_error_message?: string | null
}

export interface BucketProgress {
  bucket_id: DeletionBucket
  status: 'pending' | 'cleaning' | 'clean'
}

export interface PrefixWork {
  id: number
  bucket_id: DeletionBucket
  prefix: string
  depth: number
}

export interface ListedObject {
  id: string | null
  name: string
}

export interface DeletionRepository {
  listBucketProgress(jobId: string): Promise<BucketProgress[]>
  markBucketCleaning(
    jobId: string,
    bucket: DeletionBucket,
    leaseToken: string,
  ): Promise<void>
  markBucketClean(
    jobId: string,
    bucket: DeletionBucket,
    leaseToken: string,
  ): Promise<void>
  nextPendingPrefix(
    jobId: string,
    bucket: DeletionBucket,
  ): Promise<PrefixWork | null>
  enqueuePrefix(
    jobId: string,
    bucket: DeletionBucket,
    prefix: string,
    depth: number,
    leaseToken: string,
  ): Promise<void>
  completePrefix(
    jobId: string,
    prefixId: number,
    leaseToken: string,
  ): Promise<void>
  recordRemoved(
    jobId: string,
    bucket: DeletionBucket,
    count: number,
    leaseToken: string,
  ): Promise<void>
  finalPreflight(
    jobId: string,
    leaseToken: string,
  ): Promise<{
    ready: boolean
    status: 'cleaning_storage' | 'manual_review' | 'deleting_auth'
    errorCode?: string
  }>
  releaseInProgress(
    jobId: string,
    stage: DeletionStage,
    leaseToken: string,
  ): Promise<void>
  markDeletingAuth(jobId: string, leaseToken: string): Promise<void>
  markRetryable(
    jobId: string,
    stage: DeletionStage,
    errorCode: string,
    errorMessage: string,
    leaseToken: string,
  ): Promise<void>
  markCompleted(jobId: string, leaseToken: string): Promise<void>
}

export interface DeletionStorage {
  list(
    bucket: DeletionBucket,
    prefix: string,
    options: { limit: number; offset: number },
  ): Promise<ListedObject[]>
  remove(bucket: DeletionBucket, paths: string[]): Promise<number>
}

export interface DeletionAuth {
  userExists(userId: string): Promise<boolean>
  deleteUser(userId: string): Promise<void>
}

export interface AdvanceDeletionResult {
  status: DeletionStatus
  completed: boolean
  retryable: boolean
  errorCode?: string
}

export class DeletionStepError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'DeletionStepError'
  }
}

function objectPath(prefix: string, name: string): string {
  return `${prefix}/${name}`
}

function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof DeletionStepError) {
    return { code: error.code, message: error.message.slice(0, 500) }
  }
  return {
    code: 'unexpected_worker_error',
    message: 'Unexpected deletion worker error',
  }
}

/**
 * Advances one leased job. Every Storage list starts at offset 0: deleted files
 * disappear between batches, which avoids offset drift. Folder prefixes are
 * durable and selected deepest-first by the repository.
 */
export async function advanceDeletionJob(
  job: DeletionJob,
  repository: DeletionRepository,
  storage: DeletionStorage,
  auth: DeletionAuth,
  maxListBatches = 12,
): Promise<AdvanceDeletionResult> {
  if (job.status === 'completed') {
    return { status: 'completed', completed: true, retryable: false }
  }
  if (job.status === 'manual_review') {
    return { status: 'manual_review', completed: false, retryable: false }
  }
  if (!job.lease_token) throw new Error('A deletion job lease is required')

  let stage: DeletionStage = job.status === 'deleting_auth'
    ? 'deleting_auth'
    : 'cleaning_storage'

  try {
    if (stage === 'cleaning_storage') {
      let usedBatches = 0

      while (usedBatches < maxListBatches) {
        const progress = await repository.listBucketProgress(job.id)
        const bucket = DELETION_BUCKETS.find((id) =>
          progress.find((item) => item.bucket_id === id)?.status !== 'clean'
        )
        if (!bucket) break

        await repository.markBucketCleaning(job.id, bucket, job.lease_token)
        const prefix = await repository.nextPendingPrefix(job.id, bucket)
        if (!prefix) {
          await repository.markBucketClean(job.id, bucket, job.lease_token)
          continue
        }

        const entries = await storage.list(bucket, prefix.prefix, {
          limit: 100,
          offset: 0,
        })
        usedBatches += 1

        const folders = entries.filter((entry) => entry.id === null)
        const files = entries.filter((entry) => entry.id !== null).slice(0, 100)

        for (const folder of folders) {
          await repository.enqueuePrefix(
            job.id,
            bucket,
            objectPath(prefix.prefix, folder.name),
            prefix.depth + 1,
            job.lease_token,
          )
        }

        if (files.length > 0) {
          const paths = files.map((file) =>
            objectPath(prefix.prefix, file.name)
          )
          const removed = await storage.remove(bucket, paths)
          await repository.recordRemoved(
            job.id,
            bucket,
            removed,
            job.lease_token,
          )
          // Keep the current prefix pending and re-list from offset 0. This is
          // safe after complete or partial deletion and handles pages >100.
          continue
        }

        if (folders.length === 0) {
          await repository.completePrefix(
            job.id,
            prefix.id,
            job.lease_token,
          )
        }
        // If child folders were discovered, the parent remains pending. The
        // repository's deepest-first ordering will process children next.
      }

      const progress = await repository.listBucketProgress(job.id)
      if (progress.some((item) => item.status !== 'clean')) {
        await repository.releaseInProgress(
          job.id,
          'cleaning_storage',
          job.lease_token,
        )
        return { status: 'cleaning_storage', completed: false, retryable: true }
      }

      await repository.markDeletingAuth(job.id, job.lease_token)
      stage = 'deleting_auth'
    }

    // Run this on every deleting_auth attempt, including a retry resumed after
    // an Auth API failure, so newly committed blockers cannot loop at the FK.
    const authPreflight = await repository.finalPreflight(
      job.id,
      job.lease_token,
    )
    if (!authPreflight.ready) {
      return {
        status: authPreflight.status,
        completed: false,
        retryable: authPreflight.status === 'cleaning_storage',
        errorCode: authPreflight.errorCode,
      }
    }

    const exists = await auth.userExists(job.target_user_id)
    if (exists) await auth.deleteUser(job.target_user_id)
    // Auth deletion prevents new authenticated uploads. Re-run the durable
    // preflight before completion so any defensive late object/reference is
    // routed back through cleanup or manual review; the missing-Auth retry path
    // follows this same check.
    const postAuthPreflight = await repository.finalPreflight(
      job.id,
      job.lease_token,
    )
    if (!postAuthPreflight.ready) {
      return {
        status: postAuthPreflight.status,
        completed: false,
        retryable: postAuthPreflight.status === 'cleaning_storage',
        errorCode: postAuthPreflight.errorCode,
      }
    }
    await repository.markCompleted(job.id, job.lease_token)
    return { status: 'completed', completed: true, retryable: false }
  } catch (error) {
    const safe = safeError(error)
    await repository.markRetryable(
      job.id,
      stage,
      safe.code,
      safe.message,
      job.lease_token,
    )
    return {
      status: 'retryable_error',
      completed: false,
      retryable: true,
      errorCode: safe.code,
    }
  }
}
