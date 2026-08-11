import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type ClaimedDelivery,
  type DeliveryCompletion,
  type ReminderRepository,
  runWeeklyCheckinReminder,
} from "./orchestrator.ts";

type StoredDelivery = ClaimedDelivery & {
  status:
    | "pending"
    | "processing"
    | "sent"
    | "retryable"
    | "permanent_failed"
    | "skipped";
  lastOwner?: string;
};

class MemoryRepository implements ReminderRepository {
  runStatus = "pending";
  runClaimed = true;
  readonly deliveries: StoredDelivery[];

  constructor(count: number) {
    this.deliveries = Array.from({ length: count }, (_, index) => ({
      deliveryId: `delivery-${index}`,
      userId: `user-${index}`,
      platform: "android",
      token: `token-${index}`,
      status: "pending",
    }));
  }

  claimRun() {
    if (!this.runClaimed || this.runStatus === "completed") {
      return Promise.resolve({
        runId: "run-1",
        claimed: false,
        status: this.runStatus,
      });
    }
    this.runStatus = "running";
    return Promise.resolve({
      runId: "run-1",
      claimed: true,
      status: "running",
    });
  }

  seedDeliveries() {
    return Promise.resolve(this.deliveries.length);
  }

  claimDeliveries(_runId: string, owner: string, limit: number) {
    const claimed = this.deliveries.filter((delivery) =>
      delivery.status === "pending" ||
      (delivery.status === "retryable" && delivery.lastOwner !== owner)
    ).slice(0, limit);
    for (const delivery of claimed) {
      delivery.status = "processing";
      delivery.lastOwner = owner;
    }
    return Promise.resolve(
      claimed.map(({ deliveryId, userId, platform, token }) => ({
        deliveryId,
        userId,
        platform,
        token,
      })),
    );
  }

  completeDeliveries(
    _runId: string,
    _owner: string,
    results: DeliveryCompletion[],
  ) {
    for (const result of results) {
      const delivery = this.deliveries.find((item) =>
        item.deliveryId === result.delivery_id
      );
      if (delivery) delivery.status = result.status;
    }
    return Promise.resolve(results.length);
  }

  finalizeRun() {
    const sent =
      this.deliveries.filter((delivery) => delivery.status === "sent").length;
    const pending =
      this.deliveries.filter((delivery) =>
        delivery.status === "pending" || delivery.status === "processing"
      ).length;
    const retryable =
      this.deliveries.filter((delivery) => delivery.status === "retryable")
        .length;
    const permanent =
      this.deliveries.filter((delivery) =>
        delivery.status === "permanent_failed"
      ).length;
    const skipped =
      this.deliveries.filter((delivery) => delivery.status === "skipped")
        .length;
    this.runStatus = this.deliveries.length === 0
      ? "no_recipients"
      : pending > 0
      ? "pending"
      : retryable > 0
      ? "retryable"
      : "completed";
    return Promise.resolve({
      status: this.runStatus,
      recipientCount: this.deliveries.length,
      pendingCount: pending,
      sentCount: sent,
      retryableCount: retryable,
      permanentFailedCount: permanent,
      skippedCount: skipped,
    });
  }
}

const fixed = {
  now: () => new Date("2026-08-11T12:00:00Z"),
  randomUuid: () => "00000000-0000-4000-8000-000000000001",
};

Deno.test("concurrent invocation that does not own the run lease performs no delivery", async () => {
  const repository = new MemoryRepository(1);
  repository.runClaimed = false;
  let sends = 0;
  const outcome = await runWeeklyCheckinReminder({
    repository,
    send: () => {
      sends += 1;
      return Promise.resolve({ status: "sent" });
    },
    ...fixed,
  });
  assertEquals(outcome.status, "already_running");
  assertEquals(sends, 0);
});

Deno.test("a partial retry sends only failed deliveries and never resends successes", async () => {
  const repository = new MemoryRepository(2);
  const attempts = new Map<string, number>();
  const send = (token: string) => {
    const attempt = (attempts.get(token) ?? 0) + 1;
    attempts.set(token, attempt);
    if (token === "token-1" && attempt === 1) {
      return Promise.resolve(
        { status: "retryable", error_code: "UNAVAILABLE" } as const,
      );
    }
    return Promise.resolve(
      { status: "sent", message_name: `messages/${token}` } as const,
    );
  };

  const first = await runWeeklyCheckinReminder({ repository, send, ...fixed });
  assertEquals(first.status, "retryable");
  assertEquals(first.sentCount, 1);
  assertEquals(first.retryableCount, 1);

  const second = await runWeeklyCheckinReminder({
    repository,
    send,
    ...fixed,
    randomUuid: () => "00000000-0000-4000-8000-000000000002",
  });
  assertEquals(second.status, "completed");
  assertEquals(attempts.get("token-0"), 1);
  assertEquals(attempts.get("token-1"), 2);
});

Deno.test("delivery processing is bounded by batch size and maximum batches", async () => {
  const repository = new MemoryRepository(51);
  const outcome = await runWeeklyCheckinReminder({
    repository,
    send: () => Promise.resolve({ status: "sent" }),
    batchSize: 25,
    maxBatches: 2,
    ...fixed,
  });
  assertEquals(outcome.status, "pending");
  assertEquals(outcome.batchesProcessed, 2);
  assertEquals(outcome.deliveriesProcessed, 50);
  assertEquals(outcome.sentCount, 50);
  assertEquals(outcome.pendingCount, 1);
});

Deno.test("permanent delivery failures are terminal and are not retried", async () => {
  const repository = new MemoryRepository(1);
  let sends = 0;
  const first = await runWeeklyCheckinReminder({
    repository,
    send: () => {
      sends += 1;
      return Promise.resolve({
        status: "permanent_failed",
        error_code: "UNREGISTERED",
      });
    },
    ...fixed,
  });
  assertEquals(first.status, "completed");
  assertEquals(first.permanentFailedCount, 1);

  const second = await runWeeklyCheckinReminder({
    repository,
    send: () => {
      sends += 1;
      return Promise.resolve({ status: "sent" });
    },
    ...fixed,
    randomUuid: () => "00000000-0000-4000-8000-000000000002",
  });
  assertEquals(second.status, "completed");
  assertEquals(sends, 1);
});

Deno.test("empty target set finalizes as no_recipients", async () => {
  const repository = new MemoryRepository(0);
  const outcome = await runWeeklyCheckinReminder({
    repository,
    send: () => Promise.resolve({ status: "sent" }),
    ...fixed,
  });
  assertEquals(outcome.status, "no_recipients");
  assertEquals(outcome.recipientCount, 0);
});
