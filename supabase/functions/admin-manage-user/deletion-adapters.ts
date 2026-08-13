import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import {
  type BucketProgress,
  type DeletionAuth,
  type DeletionBucket,
  type DeletionRepository,
  type DeletionStage,
  DeletionStepError,
  type DeletionStorage,
  type ListedObject,
  type PrefixWork,
} from './deletion.ts'

function fail(code: string, operation: string): never {
  throw new DeletionStepError(code, `${operation} failed`)
}

export function createDeletionRepository(
  client: SupabaseClient,
): DeletionRepository {
  async function updateJob(
    jobId: string,
    leaseToken: string,
    patch: Record<string, unknown>,
    code: string,
  ): Promise<void> {
    const { data, error } = await client
      .from('user_deletion_jobs')
      .update(patch)
      .eq('id', jobId)
      .eq('lease_token', leaseToken)
      .gte('lease_expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle()
    if (error || !data) fail(code, 'Deletion job transition')
  }

  return {
    async listBucketProgress(jobId): Promise<BucketProgress[]> {
      const { data, error } = await client
        .from('user_deletion_bucket_progress')
        .select('bucket_id, status')
        .eq('job_id', jobId)
      if (error) fail('bucket_progress_read_failed', 'Bucket progress read')
      return (data ?? []) as BucketProgress[]
    },

    async markBucketCleaning(jobId, bucket, leaseToken) {
      const { error } = await client.rpc(
        'admin_set_user_deletion_bucket_status',
        {
          p_job_id: jobId,
          p_bucket_id: bucket,
          p_status: 'cleaning',
          p_lease_token: leaseToken,
        },
      )
      if (error) fail('bucket_progress_update_failed', 'Bucket progress update')
    },

    async markBucketClean(jobId, bucket, leaseToken) {
      const { error } = await client.rpc(
        'admin_set_user_deletion_bucket_status',
        {
          p_job_id: jobId,
          p_bucket_id: bucket,
          p_status: 'clean',
          p_lease_token: leaseToken,
        },
      )
      if (error) fail('bucket_progress_update_failed', 'Bucket completion')
    },

    async nextPendingPrefix(jobId, bucket): Promise<PrefixWork | null> {
      const { data, error } = await client
        .from('user_deletion_prefix_work')
        .select('id, bucket_id, prefix, depth')
        .eq('job_id', jobId)
        .eq('bucket_id', bucket)
        .eq('status', 'pending')
        .order('depth', { ascending: false })
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) fail('prefix_work_read_failed', 'Prefix work read')
      return data as PrefixWork | null
    },

    async enqueuePrefix(jobId, bucket, prefix, depth, leaseToken) {
      const { error } = await client.rpc(
        'admin_enqueue_user_deletion_prefix',
        {
          p_job_id: jobId,
          p_bucket_id: bucket,
          p_prefix: prefix,
          p_depth: depth,
          p_lease_token: leaseToken,
        },
      )
      if (error) fail('prefix_work_enqueue_failed', 'Prefix work enqueue')
    },

    async completePrefix(jobId, prefixId, leaseToken) {
      const { error } = await client.rpc(
        'admin_complete_user_deletion_prefix',
        {
          p_job_id: jobId,
          p_prefix_id: prefixId,
          p_lease_token: leaseToken,
        },
      )
      if (error) fail('prefix_work_update_failed', 'Prefix work completion')
    },

    async recordRemoved(jobId, bucket, count, leaseToken) {
      const { error } = await client.rpc('admin_record_user_deletion_removed', {
        p_job_id: jobId,
        p_bucket_id: bucket,
        p_removed_count: count,
        p_lease_token: leaseToken,
      })
      if (error) fail('deletion_count_update_failed', 'Deletion count update')
    },

    async finalPreflight(jobId, leaseToken) {
      const { data, error } = await client.rpc(
        'admin_preflight_user_deletion',
        { p_job_id: jobId, p_lease_token: leaseToken },
      )
      if (error) fail('final_preflight_failed', 'Final deletion preflight')
      const row = Array.isArray(data) ? data[0] : data
      if (!row || typeof row.ready !== 'boolean') {
        fail('final_preflight_failed', 'Final deletion preflight')
      }
      return {
        ready: row.ready,
        status: row.next_status,
        errorCode: typeof row.error_code === 'string'
          ? row.error_code
          : undefined,
      }
    },

    async releaseInProgress(jobId, stage, leaseToken) {
      await updateJob(jobId, leaseToken, {
        status: stage,
        lease_token: null,
        lease_expires_at: null,
      }, 'lease_release_failed')
    },

    async markDeletingAuth(jobId, leaseToken) {
      await updateJob(
        jobId,
        leaseToken,
        { status: 'deleting_auth' },
        'auth_stage_transition_failed',
      )
    },

    async markRetryable(jobId, stage, errorCode, errorMessage, leaseToken) {
      await updateJob(jobId, leaseToken, {
        status: 'retryable_error',
        resume_status: stage,
        last_error_code: errorCode,
        last_error_message: errorMessage,
        lease_token: null,
        lease_expires_at: null,
      }, 'retryable_transition_failed')
    },

    async markCompleted(jobId, leaseToken) {
      await updateJob(jobId, leaseToken, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        lease_token: null,
        lease_expires_at: null,
        resume_status: null,
        last_error_code: null,
        last_error_message: null,
      }, 'completion_transition_failed')
    },
  }
}

export function createDeletionStorage(client: SupabaseClient): DeletionStorage {
  return {
    async list(bucket, prefix, options): Promise<ListedObject[]> {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: options.limit,
        offset: options.offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) fail('storage_list_failed', 'Storage listing')
      return (data ?? []).map((item) => ({
        id: item.id ?? null,
        name: item.name,
      }))
    },

    async remove(bucket, paths): Promise<number> {
      if (paths.length === 0) return 0
      if (paths.length > 100) {
        fail('storage_batch_too_large', 'Storage deletion batch')
      }
      const { data, error } = await client.storage.from(bucket).remove(paths)
      if (error) fail('storage_remove_failed', 'Storage object deletion')
      return data?.length ?? 0
    },
  }
}

export function createDeletionAuth(client: SupabaseClient): DeletionAuth {
  return {
    async userExists(userId) {
      const { data, error } = await client.auth.admin.getUserById(userId)
      if (!error) return data.user !== null
      if (error.status === 404 || error.code === 'user_not_found') return false
      fail('auth_lookup_failed', 'Auth user lookup')
    },

    async deleteUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId)
      if (error) fail('auth_delete_failed', 'Auth user deletion')
    },
  }
}

export function asDeletionBucket(value: string): DeletionBucket {
  return value as DeletionBucket
}

export function asDeletionStage(value: string): DeletionStage {
  return value as DeletionStage
}
