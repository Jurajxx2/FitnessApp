import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type AdminManageUserDependencies,
  createAdminManageUserHandler,
  type ProfileAccountAction,
  type ProfileActionResult,
} from "./index.ts";
import type {
  AdminAuditEvent,
  AdminAuditTerminal,
  AdminAuthorizationResult,
} from "../_shared/admin-security.ts";
import type { DeletionServiceResult } from "./deletion-service.ts";

const actorUserId = "550e8400-e29b-41d4-a716-446655440000";
const targetUserId = "18a6ae93-7e04-49ca-999b-8f41da3d6a0e";

function request(userId = targetUserId, action = "block"): Request {
  return new Request("https://example.test/admin-manage-user", {
    method: "POST",
    headers: {
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, userId }),
  });
}

function dependencies(
  authorization: AdminAuthorizationResult,
  options: {
    profileResult?: ProfileActionResult;
    auditFailAt?: number;
    auditDuplicateAt?: number;
    terminal?: AdminAuditTerminal | null;
    lookupFails?: boolean;
    attemptTargetUserId?: string;
    deletionResult?: DeletionServiceResult;
    replayDeletionResult?: DeletionServiceResult;
    deletionFails?: boolean;
    replayDeletionFails?: boolean;
  } = {},
) {
  const audits: AdminAuditEvent[] = [];
  const profileActions: Array<
    { userId: string; action: ProfileAccountAction }
  > = [];
  const sequence: string[] = [];
  let privilegedCreations = 0;
  let auditWrites = 0;
  let deletionAdvances = 0;
  let deletionReads = 0;
  const defaultDeletion: DeletionServiceResult = {
    ok: true,
    httpStatus: 202,
    deletion: {
      jobId: targetUserId,
      status: "cleaning_storage",
      completed: false,
      retryable: true,
    },
  };
  const deps: AdminManageUserDependencies = {
    authorize: () => Promise.resolve(authorization),
    requestId: () => "request-manage-1",
    createPrivilegedOperations: () => {
      privilegedCreations += 1;
      return {
        advanceDeletion: () => {
          deletionAdvances += 1;
          sequence.push("mutation:delete");
          return options.deletionFails
            ? Promise.reject(new Error("deletion failed"))
            : Promise.resolve(options.deletionResult ?? defaultDeletion);
        },
        readDeletion: () => {
          deletionReads += 1;
          sequence.push("read:delete");
          return options.replayDeletionFails
            ? Promise.reject(new Error("deletion replay failed"))
            : Promise.resolve(
              options.replayDeletionResult ?? defaultDeletion,
            );
        },
        readAuditRequest: () =>
          options.lookupFails
            ? Promise.reject(new Error("audit lookup unavailable"))
            : Promise.resolve({
              attemptTargetUserId: options.attemptTargetUserId ?? targetUserId,
              terminal: options.terminal ?? null,
            }),
        applyProfileAction: (userId, action) => {
          sequence.push("mutation");
          profileActions.push({ userId, action });
          return Promise.resolve(options.profileResult ?? "updated");
        },
        recordAudit: (event) => {
          auditWrites += 1;
          if (options.auditFailAt === auditWrites) {
            return Promise.reject(new Error("audit unavailable"));
          }
          if (options.auditDuplicateAt === auditWrites) {
            return Promise.resolve("duplicate" as const);
          }
          sequence.push(`audit:${event.outcome}`);
          audits.push(event);
          return Promise.resolve("recorded" as const);
        },
      };
    },
  };
  return {
    deps,
    audits,
    profileActions,
    sequence,
    deletionAdvances: () => deletionAdvances,
    deletionReads: () => deletionReads,
    privilegedCreations: () => privilegedCreations,
  };
}

Deno.test("anonymous, athlete, aal1 admin, and blocked admin paths are denied before service role", async () => {
  const cases: Array<
    { name: string; authorization: AdminAuthorizationResult; status: number }
  > = [
    {
      name: "anonymous",
      authorization: { ok: false, reason: "authentication_required" },
      status: 401,
    },
    {
      name: "athlete",
      authorization: { ok: false, reason: "admin_required" },
      status: 403,
    },
    {
      name: "admin aal1",
      authorization: { ok: false, reason: "mfa_required" },
      status: 403,
    },
    {
      name: "blocked admin",
      authorization: { ok: false, reason: "admin_required" },
      status: 403,
    },
  ];

  for (const testCase of cases) {
    const state = dependencies(testCase.authorization);
    const response = await createAdminManageUserHandler(state.deps)(request());
    assertEquals(response.status, testCase.status, testCase.name);
    assertEquals(state.privilegedCreations(), 0, testCase.name);
    assertEquals(state.audits, [], testCase.name);
  }
});

Deno.test("every supported profile action records attempt before its atomic mutation and success after", async () => {
  const actions = ["block", "unblock", "promote_admin"] as const;

  for (const action of actions) {
    const state = dependencies({ ok: true, actorUserId });
    const response = await createAdminManageUserHandler(state.deps)(
      request(targetUserId, action),
    );

    assertEquals(response.status, 200, action);
    assertEquals(state.profileActions, [{ userId: targetUserId, action }]);
    assertEquals(state.sequence, [
      "audit:attempt",
      "mutation",
      "audit:success",
    ]);
    assertEquals(state.audits, [{
      actorUserId,
      targetUserId,
      action,
      outcome: "attempt",
      requestId: "request-manage-1",
      detail: { stage: "mutation_requested" },
    }, {
      actorUserId,
      targetUserId,
      action,
      outcome: "success",
      requestId: "request-manage-1",
      detail: {},
      response: { status: 200, body: { action, userId: targetUserId } },
    }], action);
  }
});

Deno.test("every failed account operation records a sanitized failure", async () => {
  for (const action of ["block", "unblock", "promote_admin"] as const) {
    const state = dependencies(
      { ok: true, actorUserId },
      { profileResult: "operation_failed" },
    );
    const response = await createAdminManageUserHandler(state.deps)(
      request(targetUserId, action),
    );

    assertEquals(response.status, 400, action);
    assertEquals(state.audits, [{
      actorUserId,
      targetUserId,
      action,
      outcome: "attempt",
      requestId: "request-manage-1",
      detail: { stage: "mutation_requested" },
    }, {
      actorUserId,
      targetUserId,
      action,
      outcome: "failure",
      requestId: "request-manage-1",
      detail: { reason: "account_operation_failed" },
      response: {
        status: 400,
        body: {
          error: action === "block"
            ? "Unable to disable the user"
            : action === "unblock"
            ? "Unable to activate the user"
            : "Unable to grant admin access",
        },
      },
    }], action);
  }
});

Deno.test("atomic profile RPC results cannot turn missing or concurrently protected targets into success", async () => {
  const cases: Array<{
    result: ProfileActionResult;
    status: number;
    reason: string;
  }> = [
    { result: "target_not_found", status: 404, reason: "target_not_found" },
    {
      result: "admin_target_denied",
      status: 409,
      reason: "admin_target_denied",
    },
    { result: "target_changed", status: 409, reason: "admin_target_denied" },
  ];

  for (const testCase of cases) {
    const state = dependencies(
      { ok: true, actorUserId },
      { profileResult: testCase.result },
    );
    const response = await createAdminManageUserHandler(state.deps)(request());

    assertEquals(response.status, testCase.status, testCase.result);
    assertEquals(state.audits[1]?.outcome, "failure", testCase.result);
    assertEquals(
      state.audits[1]?.detail,
      { reason: testCase.reason },
      testCase.result,
    );
  }
});

Deno.test("delete records its durable attempt before advancing and audits exact 202 progress", async () => {
  const state = dependencies({ ok: true, actorUserId });
  const response = await createAdminManageUserHandler(state.deps)(
    request(targetUserId, "delete"),
  );

  assertEquals(response.status, 202);
  assertEquals(await response.json(), {
    action: "delete",
    userId: targetUserId,
    deletion: {
      jobId: targetUserId,
      status: "cleaning_storage",
      completed: false,
      retryable: true,
    },
  });
  assertEquals(state.profileActions, []);
  assertEquals(state.deletionAdvances(), 1);
  assertEquals(state.sequence, [
    "audit:attempt",
    "mutation:delete",
    "audit:success",
  ]);
  assertEquals(state.audits, [{
    actorUserId,
    targetUserId,
    action: "delete",
    outcome: "attempt",
    requestId: "request-manage-1",
    jobId: targetUserId,
    detail: { stage: "mutation_requested" },
  }, {
    actorUserId,
    targetUserId,
    action: "delete",
    outcome: "success",
    requestId: "request-manage-1",
    jobId: targetUserId,
    detail: { status: "cleaning_storage" },
    response: {
      status: 202,
      body: {
        action: "delete",
        userId: targetUserId,
        deletion: {
          jobId: targetUserId,
          status: "cleaning_storage",
          completed: false,
          retryable: true,
        },
      },
    },
  }]);
});

Deno.test("completed deletion records and returns exact 200 success", async () => {
  const completed: DeletionServiceResult = {
    ok: true,
    httpStatus: 200,
    deletion: {
      jobId: targetUserId,
      status: "completed",
      completed: true,
      retryable: false,
    },
  };
  const state = dependencies(
    { ok: true, actorUserId },
    { deletionResult: completed },
  );

  const response = await createAdminManageUserHandler(state.deps)(
    request(targetUserId, "delete"),
  );

  assertEquals(response.status, 200);
  assertEquals((await response.json()).deletion, completed.deletion);
  assertEquals(state.audits[1]?.outcome, "success");
  assertEquals(state.audits[1]?.response?.status, 200);
  assertEquals(state.audits[1]?.jobId, targetUserId);
});

Deno.test("manual review and retryable deletion states are terminal audited failures", async () => {
  for (
    const testCase of [
      {
        status: "manual_review" as const,
        errorCode: "off_prefix_storage_objects",
        reason: "deletion_manual_review",
      },
      {
        status: "manual_review" as const,
        errorCode: "shared_direct_content",
        reason: "deletion_manual_review",
      },
      {
        status: "manual_review" as const,
        errorCode: "shared_authored_content",
        reason: "deletion_manual_review",
      },
      {
        status: "retryable_error" as const,
        errorCode: "storage_remove_failed",
        reason: "deletion_retryable_error",
      },
    ]
  ) {
    const state = dependencies(
      { ok: true, actorUserId },
      {
        deletionResult: {
          ok: true,
          httpStatus: 202,
          deletion: {
            jobId: targetUserId,
            status: testCase.status,
            completed: false,
            retryable: testCase.status === "retryable_error",
            errorCode: testCase.errorCode,
          },
        },
      },
    );

    const response = await createAdminManageUserHandler(state.deps)(
      request(targetUserId, "delete"),
    );

    assertEquals(response.status, 202, testCase.errorCode);
    assertEquals(await response.json(), {
      action: "delete",
      userId: targetUserId,
      deletion: {
        jobId: targetUserId,
        status: testCase.status,
        completed: false,
        retryable: testCase.status === "retryable_error",
        errorCode: testCase.errorCode,
      },
    }, testCase.errorCode);
    assertEquals(state.audits[1]?.outcome, "failure", testCase.errorCode);
    assertEquals(state.audits[1]?.jobId, targetUserId, testCase.errorCode);
    assertEquals(state.audits[1]?.detail, {
      reason: testCase.reason,
      status: testCase.status,
      error_code: testCase.errorCode,
    }, testCase.errorCode);
  }
});

Deno.test("manual-review recheck failure retains the job id in a sanitized terminal audit", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    {
      deletionResult: {
        ok: false,
        httpStatus: 500,
        jobId: targetUserId,
        errorCode: "manual_review_recheck_failed",
      },
    },
  );

  const response = await createAdminManageUserHandler(state.deps)(
    request(targetUserId, "delete"),
  );

  assertEquals(response.status, 500);
  assertEquals(await response.json(), { error: "Unable to delete the user" });
  assertEquals(state.audits[1]?.outcome, "failure");
  assertEquals(state.audits[1]?.jobId, targetUserId);
  assertEquals(state.audits[1]?.detail, {
    reason: "deletion_operation_failed",
    error_code: "manual_review_recheck_failed",
  });
});

Deno.test("does not mutate when the durable attempt audit is unavailable", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { auditFailAt: 1 },
  );
  const response = await createAdminManageUserHandler(state.deps)(request());

  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    error: "Unable to record the account action",
  });
  assertEquals(state.profileActions, []);
  assertEquals(state.audits, []);
});

Deno.test("attempt-only duplicate stays pending without repeating a profile mutation", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { auditDuplicateAt: 1 },
  );
  const response = await createAdminManageUserHandler(state.deps)(request());

  assertEquals(response.status, 202);
  assertEquals(await response.json(), {
    status: "pending",
    error: "This account action is still being reconciled",
    requestId: "request-manage-1",
  });
  assertEquals(state.profileActions, []);
  assertEquals(state.audits, []);
});

Deno.test("attempt-only duplicate deletion reads durable progress without advancing", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { auditDuplicateAt: 1 },
  );

  const response = await createAdminManageUserHandler(state.deps)(
    request(targetUserId, "delete"),
  );

  assertEquals(response.status, 202);
  assertEquals(state.deletionReads(), 1);
  assertEquals(state.deletionAdvances(), 0);
  assertEquals(state.audits, [{
    actorUserId,
    targetUserId,
    action: "delete",
    outcome: "success",
    requestId: "request-manage-1",
    jobId: targetUserId,
    detail: { status: "cleaning_storage" },
    response: {
      status: 202,
      body: {
        action: "delete",
        userId: targetUserId,
        deletion: {
          jobId: targetUserId,
          status: "cleaning_storage",
          completed: false,
          retryable: true,
        },
      },
    },
  }]);
});

Deno.test("attempt-only duplicate before job creation remains pending without a false terminal", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    {
      auditDuplicateAt: 1,
      replayDeletionResult: {
        ok: false,
        httpStatus: 202,
        jobId: targetUserId,
        errorCode: "deletion_job_pending",
      },
    },
  );

  const response = await createAdminManageUserHandler(state.deps)(
    request(targetUserId, "delete"),
  );

  assertEquals(response.status, 202);
  assertEquals(await response.json(), {
    status: "pending",
    error: "This account action is still being reconciled",
    requestId: "request-manage-1",
  });
  assertEquals(state.deletionReads(), 1);
  assertEquals(state.deletionAdvances(), 0);
  assertEquals(state.audits, []);
});

Deno.test("duplicate deletion target mismatch reads neither job nor worker", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { auditDuplicateAt: 1, attemptTargetUserId: actorUserId },
  );

  const response = await createAdminManageUserHandler(state.deps)(
    request(targetUserId, "delete"),
  );

  assertEquals(response.status, 409);
  assertEquals(state.deletionReads(), 0);
  assertEquals(state.deletionAdvances(), 0);
  assertEquals(state.audits, []);
});

Deno.test("duplicate deletion exactly replays its terminal response without reading or advancing", async () => {
  const terminalBody = {
    action: "delete",
    userId: targetUserId,
    deletion: {
      jobId: targetUserId,
      status: "manual_review",
      completed: false,
      retryable: false,
      errorCode: "off_prefix_storage_objects",
    },
  };
  const state = dependencies(
    { ok: true, actorUserId },
    {
      auditDuplicateAt: 1,
      terminal: {
        targetUserId,
        outcome: "failure",
        status: 202,
        body: terminalBody,
      },
    },
  );

  const response = await createAdminManageUserHandler(state.deps)(
    request(targetUserId, "delete"),
  );

  assertEquals(response.status, 202);
  assertEquals(await response.json(), terminalBody);
  assertEquals(state.deletionReads(), 0);
  assertEquals(state.deletionAdvances(), 0);
  assertEquals(state.audits, []);
});

Deno.test("duplicate deletion read failure records a sanitized terminal failure", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { auditDuplicateAt: 1, replayDeletionFails: true },
  );

  const response = await createAdminManageUserHandler(state.deps)(
    request(targetUserId, "delete"),
  );

  assertEquals(response.status, 500);
  assertEquals(state.deletionReads(), 1);
  assertEquals(state.deletionAdvances(), 0);
  assertEquals(state.audits[0]?.outcome, "failure");
  assertEquals(state.audits[0]?.jobId, targetUserId);
  assertEquals(state.audits[0]?.detail, {
    reason: "deletion_operation_failed",
    error_code: "deletion_replay_failed",
  });
});

Deno.test("terminal audit race reloads and exactly replays the winning deletion response", async () => {
  const winningBody = {
    action: "delete",
    userId: targetUserId,
    deletion: {
      jobId: targetUserId,
      status: "completed",
      completed: true,
      retryable: false,
    },
  };
  const state = dependencies(
    { ok: true, actorUserId },
    {
      auditDuplicateAt: 2,
      terminal: {
        targetUserId,
        outcome: "success",
        status: 200,
        body: winningBody,
      },
    },
  );

  const response = await createAdminManageUserHandler(state.deps)(
    request(targetUserId, "delete"),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), winningBody);
  assertEquals(state.deletionAdvances(), 1);
});

Deno.test("duplicate request replays its durable success without another mutation", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    {
      auditDuplicateAt: 1,
      terminal: {
        targetUserId,
        outcome: "success",
        status: 200,
        body: { action: "block", userId: targetUserId },
      },
    },
  );
  const response = await createAdminManageUserHandler(state.deps)(request());

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    action: "block",
    userId: targetUserId,
  });
  assertEquals(state.profileActions, []);
});

Deno.test("duplicate request replays its durable failure", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    {
      auditDuplicateAt: 1,
      terminal: {
        targetUserId,
        outcome: "failure",
        status: 409,
        body: { error: "Existing admin accounts cannot be changed here" },
      },
    },
  );
  const response = await createAdminManageUserHandler(state.deps)(request());

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    error: "Existing admin accounts cannot be changed here",
  });
  assertEquals(state.profileActions, []);
});

Deno.test("duplicate request fails closed when terminal reconciliation is unavailable", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { auditDuplicateAt: 1, lookupFails: true },
  );
  const response = await createAdminManageUserHandler(state.deps)(request());

  assertEquals(response.status, 500);
  assertEquals(state.profileActions, []);
});

Deno.test("duplicate request cannot replay another target's result", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    {
      auditDuplicateAt: 1,
      attemptTargetUserId: actorUserId,
      terminal: {
        targetUserId: actorUserId,
        outcome: "success",
        status: 200,
        body: { action: "block", userId: actorUserId },
      },
    },
  );
  const response = await createAdminManageUserHandler(state.deps)(request());

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    error: "Idempotency key belongs to another target",
  });
  assertEquals(state.profileActions, []);
});

Deno.test("a terminal audit outage leaves the durable attempt after the mutation", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { auditFailAt: 2 },
  );
  const response = await createAdminManageUserHandler(state.deps)(request());

  assertEquals(response.status, 500);
  assertEquals(state.profileActions, [{
    userId: targetUserId,
    action: "block",
  }]);
  assertEquals(state.audits, [{
    actorUserId,
    targetUserId,
    action: "block",
    outcome: "attempt",
    requestId: "request-manage-1",
    detail: { stage: "mutation_requested" },
  }]);
});

Deno.test("parsed self-action denial is audited as a sanitized failure", async () => {
  const state = dependencies({ ok: true, actorUserId });
  const response = await createAdminManageUserHandler(state.deps)(
    request(actorUserId),
  );

  assertEquals(response.status, 409);
  assertEquals(state.audits, [{
    actorUserId,
    targetUserId: actorUserId,
    action: "block",
    outcome: "attempt",
    requestId: "request-manage-1",
    detail: { stage: "mutation_requested" },
  }, {
    actorUserId,
    targetUserId: actorUserId,
    action: "block",
    outcome: "failure",
    requestId: "request-manage-1",
    detail: { reason: "self_action_denied" },
    response: {
      status: 409,
      body: { error: "You cannot change your own account access" },
    },
  }]);
});

Deno.test("self-deletion denial carries the deterministic job id and never starts a job", async () => {
  const state = dependencies({ ok: true, actorUserId });
  const response = await createAdminManageUserHandler(state.deps)(
    request(actorUserId, "delete"),
  );

  assertEquals(response.status, 409);
  assertEquals(state.deletionAdvances(), 0);
  assertEquals(
    state.audits.map((event) => ({
      outcome: event.outcome,
      jobId: event.jobId,
    })),
    [
      { outcome: "attempt", jobId: actorUserId },
      { outcome: "failure", jobId: actorUserId },
    ],
  );
});

Deno.test("a throwing authorize still answers with a CORS-bearing JSON 500", async () => {
  const state = dependencies({ ok: true, actorUserId });
  const deps: AdminManageUserDependencies = {
    ...state.deps,
    authorize: () => Promise.reject(new Error("auth backend unreachable")),
  };
  const response = await createAdminManageUserHandler(deps)(request());

  assertEquals(response.status, 500);
  assertEquals(
    response.headers.get("Access-Control-Allow-Origin"),
    "*",
  );
  assertEquals(await response.json(), { error: "Unable to manage the user" });
  assertEquals(state.privilegedCreations(), 0);
  assertEquals(state.audits, []);
});
