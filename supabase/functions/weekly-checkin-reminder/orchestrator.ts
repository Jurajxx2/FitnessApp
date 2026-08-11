import { mondayOf } from "./reminder.ts";
import type { FcmDeliveryResult } from "./fcm.ts";

export interface ReminderRunClaim {
  runId: string;
  claimed: boolean;
  status: string;
}

export interface ClaimedDelivery {
  deliveryId: string;
  userId: string;
  platform: "android" | "ios";
  token: string;
}

export interface DeliveryCompletion extends FcmDeliveryResult {
  delivery_id: string;
}

export interface ReminderRunSummary {
  status: string;
  recipientCount: number;
  pendingCount: number;
  sentCount: number;
  retryableCount: number;
  permanentFailedCount: number;
  skippedCount: number;
}

export interface ReminderRepository {
  claimRun(
    week: string,
    leaseOwner: string,
    leaseSeconds: number,
  ): Promise<ReminderRunClaim>;
  seedDeliveries(
    runId: string,
    week: string,
    leaseOwner: string,
  ): Promise<number>;
  claimDeliveries(
    runId: string,
    leaseOwner: string,
    limit: number,
    leaseSeconds: number,
  ): Promise<ClaimedDelivery[]>;
  completeDeliveries(
    runId: string,
    leaseOwner: string,
    results: DeliveryCompletion[],
  ): Promise<number>;
  finalizeRun(runId: string, leaseOwner: string): Promise<ReminderRunSummary>;
}

export interface ReminderOutcome extends ReminderRunSummary {
  week: string;
  batchesProcessed: number;
  deliveriesProcessed: number;
}

export interface ReminderDependencies {
  repository: ReminderRepository;
  send: (token: string) => Promise<FcmDeliveryResult>;
  now?: () => Date;
  randomUuid?: () => string;
  batchSize?: number;
  maxBatches?: number;
  week?: string;
}

const RUN_LEASE_SECONDS = 600;
const DELIVERY_LEASE_SECONDS = 180;

export async function runWeeklyCheckinReminder(
  dependencies: ReminderDependencies,
): Promise<ReminderOutcome> {
  const now = dependencies.now?.() ?? new Date();
  const week = dependencies.week ?? mondayOf(now);
  const leaseOwner = dependencies.randomUuid?.() ?? crypto.randomUUID();
  const batchSize = dependencies.batchSize ?? 50;
  const maxBatches = dependencies.maxBatches ?? 10;
  if (batchSize < 1 || batchSize > 100) {
    throw new Error("batchSize must be between 1 and 100");
  }
  if (maxBatches < 1 || maxBatches > 20) {
    throw new Error("maxBatches must be between 1 and 20");
  }

  const claim = await dependencies.repository.claimRun(
    week,
    leaseOwner,
    RUN_LEASE_SECONDS,
  );
  if (!claim.claimed) {
    return {
      week,
      status: claim.status === "completed" ? "completed" : "already_running",
      recipientCount: 0,
      pendingCount: 0,
      sentCount: 0,
      retryableCount: 0,
      permanentFailedCount: 0,
      skippedCount: 0,
      batchesProcessed: 0,
      deliveriesProcessed: 0,
    };
  }

  await dependencies.repository.seedDeliveries(claim.runId, week, leaseOwner);

  let batchesProcessed = 0;
  let deliveriesProcessed = 0;
  for (; batchesProcessed < maxBatches; batchesProcessed += 1) {
    const deliveries = await dependencies.repository.claimDeliveries(
      claim.runId,
      leaseOwner,
      batchSize,
      DELIVERY_LEASE_SECONDS,
    );
    if (deliveries.length === 0) break;

    const settled = await Promise.all(
      deliveries.map(async (delivery): Promise<DeliveryCompletion> => {
        try {
          const result = await dependencies.send(delivery.token);
          return { delivery_id: delivery.deliveryId, ...result };
        } catch (error) {
          return {
            delivery_id: delivery.deliveryId,
            status: "retryable",
            error_code: "sender_error",
            error_message: error instanceof Error
              ? error.message.slice(0, 500)
              : "FCM sender failed",
          };
        }
      }),
    );
    const updated = await dependencies.repository.completeDeliveries(
      claim.runId,
      leaseOwner,
      settled,
    );
    if (updated !== deliveries.length) {
      throw new Error(
        `Only ${updated}/${deliveries.length} claimed deliveries were completed`,
      );
    }
    deliveriesProcessed += deliveries.length;
  }

  const summary = await dependencies.repository.finalizeRun(
    claim.runId,
    leaseOwner,
  );
  return { week, ...summary, batchesProcessed, deliveriesProcessed };
}
