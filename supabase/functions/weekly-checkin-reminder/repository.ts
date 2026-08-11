import type {
  ClaimedDelivery,
  DeliveryCompletion,
  ReminderRepository,
  ReminderRunClaim,
  ReminderRunSummary,
} from "./orchestrator.ts";

interface RpcError {
  message: string;
}

export interface RpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: RpcError | null }>;
}

function firstRow(data: unknown, operation: string): Record<string, unknown> {
  if (
    !Array.isArray(data) || data.length !== 1 || typeof data[0] !== "object" ||
    data[0] === null
  ) {
    throw new Error(`${operation} returned an invalid response`);
  }
  return data[0] as Record<string, unknown>;
}

function requiredString(
  row: Record<string, unknown>,
  key: string,
  operation: string,
): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`${operation} response is missing ${key}`);
  }
  return value;
}

function requiredNumber(
  row: Record<string, unknown>,
  key: string,
  operation: string,
): number {
  const value = row[key];
  if (typeof value !== "number") {
    throw new Error(`${operation} response is missing ${key}`);
  }
  return value;
}

export class SupabaseReminderRepository implements ReminderRepository {
  constructor(private readonly client: RpcClient) {}

  private async rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw new Error(`${name} failed: ${error.message}`);
    return data;
  }

  async claimRun(
    week: string,
    leaseOwner: string,
    leaseSeconds: number,
  ): Promise<ReminderRunClaim> {
    const row = firstRow(
      await this.rpc("claim_weekly_checkin_reminder_run", {
        p_reminder_week: week,
        p_lease_owner: leaseOwner,
        p_lease_seconds: leaseSeconds,
      }),
      "claim run",
    );
    if (typeof row.claimed !== "boolean") {
      throw new Error("claim run response is missing claimed");
    }
    return {
      runId: requiredString(row, "run_id", "claim run"),
      claimed: row.claimed,
      status: requiredString(row, "run_status", "claim run"),
    };
  }

  async seedDeliveries(
    runId: string,
    week: string,
    leaseOwner: string,
  ): Promise<number> {
    const value = await this.rpc("seed_weekly_checkin_reminder_deliveries", {
      p_run_id: runId,
      p_reminder_week: week,
      p_lease_owner: leaseOwner,
    });
    if (typeof value !== "number") {
      throw new Error("seed deliveries returned an invalid response");
    }
    return value;
  }

  async claimDeliveries(
    runId: string,
    leaseOwner: string,
    limit: number,
    leaseSeconds: number,
  ): Promise<ClaimedDelivery[]> {
    const data = await this.rpc("claim_weekly_checkin_reminder_deliveries", {
      p_run_id: runId,
      p_lease_owner: leaseOwner,
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });
    if (!Array.isArray(data)) {
      throw new Error("claim deliveries returned an invalid response");
    }
    return data.map((value) => {
      if (typeof value !== "object" || value === null) {
        throw new Error("claim deliveries returned an invalid row");
      }
      const row = value as Record<string, unknown>;
      return {
        deliveryId: requiredString(row, "delivery_id", "claim deliveries"),
        userId: requiredString(row, "user_id", "claim deliveries"),
        platform: requiredString(row, "platform", "claim deliveries") as
          | "android"
          | "ios",
        token: requiredString(row, "token", "claim deliveries"),
      };
    });
  }

  async completeDeliveries(
    runId: string,
    leaseOwner: string,
    results: DeliveryCompletion[],
  ): Promise<number> {
    const value = await this.rpc(
      "complete_weekly_checkin_reminder_deliveries",
      {
        p_run_id: runId,
        p_lease_owner: leaseOwner,
        p_results: results,
      },
    );
    if (typeof value !== "number") {
      throw new Error("complete deliveries returned an invalid response");
    }
    return value;
  }

  async finalizeRun(
    runId: string,
    leaseOwner: string,
  ): Promise<ReminderRunSummary> {
    const row = firstRow(
      await this.rpc("finalize_weekly_checkin_reminder_run", {
        p_run_id: runId,
        p_lease_owner: leaseOwner,
      }),
      "finalize run",
    );
    return {
      status: requiredString(row, "run_status", "finalize run"),
      recipientCount: requiredNumber(row, "recipient_count", "finalize run"),
      pendingCount: requiredNumber(row, "pending_count", "finalize run"),
      sentCount: requiredNumber(row, "sent_count", "finalize run"),
      retryableCount: requiredNumber(row, "retryable_count", "finalize run"),
      permanentFailedCount: requiredNumber(
        row,
        "permanent_failed_count",
        "finalize run",
      ),
      skippedCount: requiredNumber(row, "skipped_count", "finalize run"),
    };
  }
}
