import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  advanceDeletionJob,
  type BucketProgress,
  DELETION_BUCKETS,
  type DeletionAuth,
  type DeletionBucket,
  type DeletionJob,
  type DeletionRepository,
  type DeletionStage,
  DeletionStepError,
  type DeletionStorage,
  type ListedObject,
  type PrefixWork,
} from './deletion.ts'

const baseJob: DeletionJob = {
  id: 'job-1',
  target_user_id: '550e8400-e29b-41d4-a716-446655440000',
  requested_by: '550e8400-e29b-41d4-a716-446655440001',
  status: 'cleaning_storage',
  lease_token: 'lease-1',
}

class FakeRepository implements DeletionRepository {
  progress = new Map<DeletionBucket, BucketProgress['status']>(
    DELETION_BUCKETS.map((bucket) => [bucket, 'pending']),
  )
  prefixes: Array<PrefixWork & { status: 'pending' | 'complete' }> =
    DELETION_BUCKETS.map((bucket, index) => ({
      id: index + 1,
      bucket_id: bucket,
      prefix: baseJob.target_user_id,
      depth: 0,
      status: 'pending',
    }))
  nextId = this.prefixes.length + 1
  removed = 0
  status: DeletionJob['status'] = 'cleaning_storage'
  resumeStatus: DeletionStage | null = null
  errorCode: string | null = null
  preflightCalls = 0
  preflightQueue: Array<{
    ready: boolean
    status: 'cleaning_storage' | 'manual_review' | 'deleting_auth'
    errorCode?: string
  }> = []
  preflight: {
    ready: boolean
    status: 'cleaning_storage' | 'manual_review' | 'deleting_auth'
    errorCode?: string
  } = {
    ready: true,
    status: 'deleting_auth',
  }

  listBucketProgress(): Promise<BucketProgress[]> {
    return Promise.resolve(
      DELETION_BUCKETS.map((bucket) => ({
        bucket_id: bucket,
        status: this.progress.get(bucket)!,
      })),
    )
  }
  markBucketCleaning(_jobId: string, bucket: DeletionBucket): Promise<void> {
    this.progress.set(bucket, 'cleaning')
    return Promise.resolve()
  }
  markBucketClean(_jobId: string, bucket: DeletionBucket): Promise<void> {
    this.progress.set(bucket, 'clean')
    return Promise.resolve()
  }
  nextPendingPrefix(
    _jobId: string,
    bucket: DeletionBucket,
  ): Promise<PrefixWork | null> {
    const next = this.prefixes
      .filter((prefix) =>
        prefix.bucket_id === bucket && prefix.status === 'pending'
      )
      .sort((a, b) => b.depth - a.depth || a.id - b.id)[0]
    return Promise.resolve(next ?? null)
  }
  enqueuePrefix(
    _jobId: string,
    bucket: DeletionBucket,
    prefix: string,
    depth: number,
    _leaseToken: string,
  ): Promise<void> {
    if (
      !this.prefixes.some((item) =>
        item.bucket_id === bucket && item.prefix === prefix
      )
    ) {
      this.prefixes.push({
        id: this.nextId++,
        bucket_id: bucket,
        prefix,
        depth,
        status: 'pending',
      })
    }
    return Promise.resolve()
  }
  completePrefix(
    _jobId: string,
    prefixId: number,
  ): Promise<void> {
    this.prefixes.find((prefix) => prefix.id === prefixId)!.status = 'complete'
    return Promise.resolve()
  }
  recordRemoved(
    _jobId: string,
    _bucket: DeletionBucket,
    count: number,
  ): Promise<void> {
    this.removed += count
    return Promise.resolve()
  }
  finalPreflight(): Promise<{
    ready: boolean
    status: 'cleaning_storage' | 'manual_review' | 'deleting_auth'
    errorCode?: string
  }> {
    this.preflightCalls += 1
    const result = this.preflightQueue.shift() ?? this.preflight
    if (!result.ready) this.status = result.status
    return Promise.resolve(result)
  }
  releaseInProgress(_jobId: string, stage: DeletionStage): Promise<void> {
    this.status = stage
    return Promise.resolve()
  }
  markDeletingAuth(): Promise<void> {
    this.status = 'deleting_auth'
    return Promise.resolve()
  }
  markRetryable(
    _jobId: string,
    stage: DeletionStage,
    errorCode: string,
  ): Promise<void> {
    this.status = 'retryable_error'
    this.resumeStatus = stage
    this.errorCode = errorCode
    return Promise.resolve()
  }
  markCompleted(): Promise<void> {
    this.status = 'completed'
    return Promise.resolve()
  }
}

class FakeStorage implements DeletionStorage {
  objects = new Map<DeletionBucket, Set<string>>(
    DELETION_BUCKETS.map((bucket) => [bucket, new Set()]),
  )
  listCalls: Array<
    { bucket: DeletionBucket; prefix: string; limit: number; offset: number }
  > = []
  removeCalls: string[][] = []
  failNextRemoveAfter: number | null = null

  list(
    bucket: DeletionBucket,
    prefix: string,
    options: { limit: number; offset: number },
  ): Promise<ListedObject[]> {
    this.listCalls.push({ bucket, prefix, ...options })
    const directFiles = new Set<string>()
    const folders = new Set<string>()
    const prefixWithSlash = `${prefix}/`
    for (const path of this.objects.get(bucket)!) {
      if (!path.startsWith(prefixWithSlash)) continue
      const remainder = path.slice(prefixWithSlash.length)
      const slash = remainder.indexOf('/')
      if (slash === -1) directFiles.add(remainder)
      else folders.add(remainder.slice(0, slash))
    }
    const entries: ListedObject[] = [
      ...[...folders].sort().map((name) => ({ id: null, name })),
      ...[...directFiles].sort().map((name) => ({ id: `id-${name}`, name })),
    ]
    return Promise.resolve(
      entries.slice(options.offset, options.offset + options.limit),
    )
  }

  remove(bucket: DeletionBucket, paths: string[]): Promise<number> {
    this.removeCalls.push(paths)
    if (this.failNextRemoveAfter !== null) {
      const removed = paths.slice(0, this.failNextRemoveAfter)
      removed.forEach((path) => this.objects.get(bucket)!.delete(path))
      this.failNextRemoveAfter = null
      throw new DeletionStepError(
        'storage_remove_failed',
        'Storage remove failed after a partial response',
      )
    }
    paths.forEach((path) => this.objects.get(bucket)!.delete(path))
    return Promise.resolve(paths.length)
  }
}

class FakeAuth implements DeletionAuth {
  exists = true
  deleteCalls = 0
  failDelete = false
  userExists(): Promise<boolean> {
    return Promise.resolve(this.exists)
  }
  deleteUser(): Promise<void> {
    this.deleteCalls += 1
    if (this.failDelete) {
      throw new DeletionStepError('auth_delete_failed', 'Auth deletion failed')
    }
    this.exists = false
    return Promise.resolve()
  }
}

Deno.test('recursively discovers child prefixes and deletes deepest-first', async () => {
  const repository = new FakeRepository()
  const storage = new FakeStorage()
  const auth = new FakeAuth()
  storage.objects.get('chat-images')!.add(
    `${baseJob.target_user_id}/year/week/photo.jpg`,
  )

  const result = await advanceDeletionJob(
    baseJob,
    repository,
    storage,
    auth,
    20,
  )

  assertEquals(result.status, 'completed')
  assertEquals(storage.objects.get('chat-images')!.size, 0)
  const prefixes = storage.listCalls.filter((call) =>
    call.bucket === 'chat-images'
  ).map((call) => call.prefix)
  assert(
    prefixes.indexOf(`${baseJob.target_user_id}/year/week`) <
      prefixes.lastIndexOf(baseJob.target_user_id),
  )
  assertEquals(auth.deleteCalls, 1)
})

Deno.test('lists every page from offset zero and removes at most 100 objects per batch', async () => {
  const repository = new FakeRepository()
  const storage = new FakeStorage()
  const auth = new FakeAuth()
  for (let index = 0; index < 215; index += 1) {
    storage.objects.get('meal-photos')!.add(
      `${baseJob.target_user_id}/photo-${String(index).padStart(3, '0')}.jpg`,
    )
  }

  const result = await advanceDeletionJob(
    baseJob,
    repository,
    storage,
    auth,
    20,
  )

  assertEquals(result.completed, true)
  assert(storage.removeCalls.every((paths) => paths.length <= 100))
  assertEquals(storage.removeCalls.map((paths) => paths.length), [100, 100, 15])
  assert(
    storage.listCalls.every((call) => call.offset === 0 && call.limit === 100),
  )
})

Deno.test('records a retryable storage failure and resumes without losing the durable prefix', async () => {
  const repository = new FakeRepository()
  const storage = new FakeStorage()
  const auth = new FakeAuth()
  storage.objects.get('chat-images')!.add(`${baseJob.target_user_id}/one.jpg`)
  storage.objects.get('chat-images')!.add(`${baseJob.target_user_id}/two.jpg`)
  storage.failNextRemoveAfter = 1

  const failed = await advanceDeletionJob(
    baseJob,
    repository,
    storage,
    auth,
    20,
  )
  assertEquals(failed, {
    status: 'retryable_error',
    completed: false,
    retryable: true,
    errorCode: 'storage_remove_failed',
  })
  assertEquals(repository.resumeStatus, 'cleaning_storage')
  assertEquals(storage.objects.get('chat-images')!.size, 1)

  const resumed = await advanceDeletionJob(
    { ...baseJob, lease_token: 'lease-2' },
    repository,
    storage,
    auth,
    20,
  )
  assertEquals(resumed.completed, true)
  assertEquals(storage.objects.get('chat-images')!.size, 0)
})

Deno.test('resumes at Auth deletion after an Auth API failure', async () => {
  const repository = new FakeRepository()
  repository.progress = new Map(
    DELETION_BUCKETS.map((bucket) => [bucket, 'clean']),
  )
  const storage = new FakeStorage()
  const auth = new FakeAuth()
  auth.failDelete = true

  const failed = await advanceDeletionJob(baseJob, repository, storage, auth)
  assertEquals(failed.status, 'retryable_error')
  assertEquals(repository.resumeStatus, 'deleting_auth')

  auth.failDelete = false
  const resumed = await advanceDeletionJob(
    { ...baseJob, status: 'deleting_auth', lease_token: 'lease-2' },
    repository,
    storage,
    auth,
  )
  assertEquals(resumed.completed, true)
  assertEquals(auth.deleteCalls, 2)
})

Deno.test('a missing Auth user is an idempotent completed deletion', async () => {
  const repository = new FakeRepository()
  repository.progress = new Map(
    DELETION_BUCKETS.map((bucket) => [bucket, 'clean']),
  )
  const auth = new FakeAuth()
  auth.exists = false

  const result = await advanceDeletionJob(
    baseJob,
    repository,
    new FakeStorage(),
    auth,
  )

  assertEquals(result.completed, true)
  assertEquals(repository.status, 'completed')
  assertEquals(auth.deleteCalls, 0)
  assertEquals(repository.preflightCalls, 2)
})

Deno.test('rechecks storage after Auth deletion and defers completion for late objects', async () => {
  const repository = new FakeRepository()
  repository.progress = new Map(
    DELETION_BUCKETS.map((bucket) => [bucket, 'clean']),
  )
  repository.preflightQueue = [
    { ready: true, status: 'deleting_auth' },
    {
      ready: false,
      status: 'cleaning_storage',
      errorCode: 'in_prefix_storage_objects',
    },
  ]
  const storage = new FakeStorage()
  const auth = new FakeAuth()

  const result = await advanceDeletionJob(baseJob, repository, storage, auth)

  assertEquals(result, {
    status: 'cleaning_storage',
    completed: false,
    retryable: true,
    errorCode: 'in_prefix_storage_objects',
  })
  assertEquals(auth.deleteCalls, 1)
  assertEquals(repository.preflightCalls, 2)
  assertEquals(repository.status, 'cleaning_storage')
})

Deno.test('rechecks blockers before every resumed Auth deletion attempt', async () => {
  const repository = new FakeRepository()
  repository.preflight = {
    ready: false,
    status: 'manual_review',
    errorCode: 'retained_generation_request',
  }
  const storage = new FakeStorage()
  const auth = new FakeAuth()

  const result = await advanceDeletionJob(
    { ...baseJob, status: 'deleting_auth' },
    repository,
    storage,
    auth,
  )

  assertEquals(result, {
    status: 'manual_review',
    completed: false,
    retryable: false,
    errorCode: 'retained_generation_request',
  })
  assertEquals(auth.deleteCalls, 0)
  assertEquals(repository.preflightCalls, 1)
})

Deno.test('repeats owner preflight after storage cleanup and stops before Auth deletion', async () => {
  const repository = new FakeRepository()
  repository.progress = new Map(
    DELETION_BUCKETS.map((bucket) => [bucket, 'clean']),
  )
  repository.preflight = {
    ready: false,
    status: 'manual_review',
    errorCode: 'off_prefix_storage_objects',
  }
  const auth = new FakeAuth()

  const result = await advanceDeletionJob(
    baseJob,
    repository,
    new FakeStorage(),
    auth,
  )

  assertEquals(result, {
    status: 'manual_review',
    completed: false,
    retryable: false,
    errorCode: 'off_prefix_storage_objects',
  })
  assertEquals(auth.deleteCalls, 0)
})

Deno.test('treats authored shared content exactly like shared direct content', async () => {
  // Scope: this pins the worker's GENERIC manual-review handling only. The
  // worker branches on status, never on the code, so the code is an opaque
  // passthrough string here and this test would pass for any value. The actual
  // classification — which database condition yields shared_authored_content
  // versus shared_direct_content — is proven by
  // supabase/verification/user_deletion_jobs.sql.
  for (
    const errorCode of ['shared_direct_content', 'shared_authored_content']
  ) {
    const repository = new FakeRepository()
    repository.progress = new Map(
      DELETION_BUCKETS.map((bucket) => [bucket, 'clean']),
    )
    repository.preflight = {
      ready: false,
      status: 'manual_review',
      errorCode,
    }
    const auth = new FakeAuth()

    const result = await advanceDeletionJob(
      baseJob,
      repository,
      new FakeStorage(),
      auth,
    )

    assertEquals(result, {
      status: 'manual_review',
      completed: false,
      retryable: false,
      errorCode,
    }, errorCode)
    assertEquals(auth.deleteCalls, 0, errorCode)
    assertEquals(repository.preflightCalls, 1, errorCode)
    assertEquals(repository.status, 'manual_review', errorCode)
    assertEquals(repository.resumeStatus, null, errorCode)
  }
})

Deno.test('a manual-review job is never advanced on a later invocation', async () => {
  const repository = new FakeRepository()
  repository.status = 'manual_review'
  const auth = new FakeAuth()

  const result = await advanceDeletionJob(
    { ...baseJob, status: 'manual_review', lease_token: null },
    repository,
    new FakeStorage(),
    auth,
  )

  assertEquals(result, {
    status: 'manual_review',
    completed: false,
    retryable: false,
  })
  assertEquals(repository.preflightCalls, 0)
  assertEquals(auth.deleteCalls, 0)
})

Deno.test('returns to storage cleanup when final preflight finds an in-prefix upload', async () => {
  const repository = new FakeRepository()
  repository.progress = new Map(
    DELETION_BUCKETS.map((bucket) => [bucket, 'clean']),
  )
  repository.preflight = {
    ready: false,
    status: 'cleaning_storage',
    errorCode: 'in_prefix_storage_objects',
  }
  const auth = new FakeAuth()

  const result = await advanceDeletionJob(
    baseJob,
    repository,
    new FakeStorage(),
    auth,
  )

  assertEquals(result, {
    status: 'cleaning_storage',
    completed: false,
    retryable: true,
    errorCode: 'in_prefix_storage_objects',
  })
  assertEquals(auth.deleteCalls, 0)
})

Deno.test('stops after the configured list budget and remains retryable in progress', async () => {
  const repository = new FakeRepository()
  const storage = new FakeStorage()
  const auth = new FakeAuth()
  for (let index = 0; index < 150; index += 1) {
    storage.objects.get('chat-images')!.add(
      `${baseJob.target_user_id}/${index}.jpg`,
    )
  }

  const result = await advanceDeletionJob(baseJob, repository, storage, auth, 1)

  assertEquals(result, {
    status: 'cleaning_storage',
    completed: false,
    retryable: true,
  })
  assertEquals(storage.removeCalls.length, 1)
  assertEquals(auth.deleteCalls, 0)
})
