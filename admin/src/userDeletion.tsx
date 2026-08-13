import { Button, Card } from './components/ui'
import { supabase } from './lib/supabase'

export type UserDeletionStatus =
  | 'requested'
  | 'cleaning_storage'
  | 'deleting_auth'
  | 'retryable_error'
  | 'manual_review'
  | 'completed'

export interface UserDeletionJob {
  id: string
  target_user_id: string
  requested_by: string
  status: UserDeletionStatus
  attempt_count: number
  removed_object_count: number
  last_error_code: string | null
  last_error_message: string | null
  updated_at: string
}

export interface DeletionResponse {
  action: 'delete'
  userId: string
  deletion: {
    jobId: string
    status: UserDeletionStatus
    completed: boolean
    retryable: boolean
    errorCode?: string
  }
}

export class DeletionRequestIdStore {
  private readonly ids = new Map<string, string>()

  idFor(targetUserId: string): string {
    const existing = this.ids.get(targetUserId)
    if (existing) return existing
    const created = crypto.randomUUID()
    this.ids.set(targetUserId, created)
    return created
  }

  complete(targetUserId: string): void {
    this.ids.delete(targetUserId)
  }
}

export class UserDeletionRequestError extends Error {
  constructor(message: string, readonly response?: Response) {
    super(message)
    this.name = 'UserDeletionRequestError'
  }
}

export function isDefinitiveDeletionError(response?: Response): boolean {
  return response !== undefined && response.status !== 408
}

export async function requestUserDeletion(
  userId: string,
  requestId: string = crypto.randomUUID(),
): Promise<DeletionResponse> {
  const { data, error, response } = await supabase.functions.invoke<DeletionResponse>('admin-manage-user', {
    body: { action: 'delete', userId },
    headers: { 'x-request-id': requestId },
  })
  if (error) throw new UserDeletionRequestError(error.message, response)
  if (data?.action !== 'delete' || data.userId !== userId || !data.deletion?.jobId) {
    throw new UserDeletionRequestError('The server returned an unexpected deletion response', response)
  }
  return data
}

export function deletionIsComplete(response: { deletion?: { completed: boolean } }): boolean {
  return response.deletion?.completed === true
}

const STATUS_COPY: Record<UserDeletionStatus, string> = {
  requested: 'Waiting to start',
  cleaning_storage: 'Cleaning storage',
  deleting_auth: 'Deleting account',
  retryable_error: 'Needs retry',
  manual_review: 'Manual review required',
  completed: 'Completed',
}

export function DeletionJobCard({
  job,
  pending = false,
  onRetry,
}: {
  job: UserDeletionJob
  pending?: boolean
  onRetry?: (targetUserId: string) => Promise<unknown> | unknown
}) {
  const canRetry = job.status !== 'completed'
  return (
    <Card className="border-warning/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Account deletion</h3>
          <p className="mt-1 text-xs text-text-secondary">{STATUS_COPY[job.status]}</p>
          <p className="mt-2 break-all font-mono text-[10px] text-text-secondary">{job.target_user_id}</p>
          <p className="mt-1 text-[11px] text-text-secondary">
            {job.removed_object_count} storage objects removed · {job.attempt_count} attempts
          </p>
          {job.last_error_message && (
            <p className="mt-2 text-xs text-error">{job.last_error_message}</p>
          )}
        </div>
        {canRetry && onRetry && (
          <Button variant="ghost" loading={pending} onClick={() => void onRetry(job.target_user_id)}>
            {job.status === 'manual_review' ? 'Recheck deletion' : 'Retry deletion'}
          </Button>
        )}
      </div>
    </Card>
  )
}
