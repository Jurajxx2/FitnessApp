import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type AdminCreateUserDependencies,
  createAdminCreateUserHandler,
} from "./index.ts";
import type {
  AdminAuditEvent,
  AdminAuditTerminal,
  AdminAuthorizationResult,
} from "../_shared/admin-security.ts";

const actorUserId = "550e8400-e29b-41d4-a716-446655440000";
const targetUserId = "18a6ae93-7e04-49ca-999b-8f41da3d6a0e";

function dependencies(
  authorization: AdminAuthorizationResult,
  inviteResult: { userId: string | null; errorCode: string | null } = {
    userId: targetUserId,
    errorCode: null,
  },
  auditBehavior: {
    failAt?: number;
    duplicateAt?: number;
    terminal?: AdminAuditTerminal | null;
    lookupFails?: boolean;
  } = {},
) {
  const audits: AdminAuditEvent[] = [];
  const invites: Array<{ email: string; fullName: string }> = [];
  const sequence: string[] = [];
  let privilegedCreations = 0;
  let auditWrites = 0;
  const deps: AdminCreateUserDependencies = {
    authorize: () => Promise.resolve(authorization),
    requestId: () => "request-create-1",
    createPrivilegedOperations: () => {
      privilegedCreations += 1;
      return {
        readAuditRequest: () =>
          auditBehavior.lookupFails
            ? Promise.reject(new Error("audit lookup unavailable"))
            : Promise.resolve({
              attemptTargetUserId: null,
              terminal: auditBehavior.terminal ?? null,
            }),
        inviteUser: (invite) => {
          sequence.push("mutation");
          invites.push(invite);
          return Promise.resolve(inviteResult);
        },
        recordAudit: (event) => {
          auditWrites += 1;
          if (auditBehavior.failAt === auditWrites) {
            return Promise.reject(new Error("audit unavailable"));
          }
          if (auditBehavior.duplicateAt === auditWrites) {
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
    invites,
    sequence,
    privilegedCreations: () => privilegedCreations,
  };
}

function request(): Request {
  return new Request("https://example.test/admin-create-user", {
    method: "POST",
    headers: {
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: " NEW@Example.com ",
      fullName: "  New   Athlete ",
    }),
  });
}

Deno.test("authorized aal2 admin invitation is normalized and audited without PII detail", async () => {
  const state = dependencies({ ok: true, actorUserId });
  const response = await createAdminCreateUserHandler(state.deps)(request());

  assertEquals(response.status, 201);
  assertEquals(state.invites, [{
    email: "new@example.com",
    fullName: "New Athlete",
  }]);
  assertEquals(state.sequence, ["audit:attempt", "mutation", "audit:success"]);
  assertEquals(state.audits, [{
    actorUserId,
    targetUserId: null,
    action: "invite_user",
    outcome: "attempt",
    requestId: "request-create-1",
    detail: { stage: "mutation_requested" },
  }, {
    actorUserId,
    targetUserId,
    action: "invite_user",
    outcome: "success",
    requestId: "request-create-1",
    detail: {},
    response: { status: 201, body: { user: { id: targetUserId } } },
  }]);
});

Deno.test("duplicate invitation failure is audited without the target email", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { userId: null, errorCode: "email_exists" },
  );
  const response = await createAdminCreateUserHandler(state.deps)(request());

  assertEquals(response.status, 400);
  assertEquals(state.audits, [{
    actorUserId,
    targetUserId: null,
    action: "invite_user",
    outcome: "attempt",
    requestId: "request-create-1",
    detail: { stage: "mutation_requested" },
  }, {
    actorUserId,
    targetUserId: null,
    action: "invite_user",
    outcome: "failure",
    requestId: "request-create-1",
    detail: { reason: "duplicate_identity" },
    response: {
      status: 400,
      body: { error: "A user with this email already exists" },
    },
  }]);
});

Deno.test("does not mutate when the durable attempt audit cannot be inserted", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { userId: targetUserId, errorCode: null },
    { failAt: 1 },
  );
  const response = await createAdminCreateUserHandler(state.deps)(request());

  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    error: "Unable to record the account action",
  });
  assertEquals(state.invites, []);
  assertEquals(state.audits, []);
});

Deno.test("attempt-only duplicate does not repeat an invitation and stays pending", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { userId: targetUserId, errorCode: null },
    { duplicateAt: 1 },
  );
  const response = await createAdminCreateUserHandler(state.deps)(request());

  assertEquals(response.status, 202);
  assertEquals(await response.json(), {
    status: "pending",
    error: "This invitation is still being reconciled",
    requestId: "request-create-1",
  });
  assertEquals(state.invites, []);
  assertEquals(state.audits, []);
});

Deno.test("duplicate invitation replays its durable success", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { userId: targetUserId, errorCode: null },
    {
      duplicateAt: 1,
      terminal: {
        targetUserId,
        outcome: "success",
        status: 201,
        body: { user: { id: targetUserId } },
      },
    },
  );
  const response = await createAdminCreateUserHandler(state.deps)(request());

  assertEquals(response.status, 201);
  assertEquals(await response.json(), {
    user: { id: targetUserId },
  });
  assertEquals(state.invites, []);
});

Deno.test("duplicate invitation replays its durable failure", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { userId: targetUserId, errorCode: null },
    {
      duplicateAt: 1,
      terminal: {
        targetUserId: null,
        outcome: "failure",
        status: 400,
        body: { error: "A user with this email already exists" },
      },
    },
  );
  const response = await createAdminCreateUserHandler(state.deps)(request());

  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: "A user with this email already exists",
  });
  assertEquals(state.invites, []);
});

Deno.test("duplicate invitation fails closed when reconciliation is unavailable", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { userId: targetUserId, errorCode: null },
    { duplicateAt: 1, lookupFails: true },
  );
  const response = await createAdminCreateUserHandler(state.deps)(request());

  assertEquals(response.status, 500);
  assertEquals(state.invites, []);
});

Deno.test("preserves the durable attempt if the terminal audit write is unavailable", async () => {
  const state = dependencies(
    { ok: true, actorUserId },
    { userId: targetUserId, errorCode: null },
    { failAt: 2 },
  );
  const response = await createAdminCreateUserHandler(state.deps)(request());

  assertEquals(response.status, 500);
  assertEquals(state.invites.length, 1);
  assertEquals(state.audits, [{
    actorUserId,
    targetUserId: null,
    action: "invite_user",
    outcome: "attempt",
    requestId: "request-create-1",
    detail: { stage: "mutation_requested" },
  }]);
});

Deno.test("unauthorized invitation never creates a service-role operation client", async () => {
  const state = dependencies({ ok: false, reason: "mfa_required" });
  const response = await createAdminCreateUserHandler(state.deps)(request());

  assertEquals(response.status, 403);
  assertEquals(state.privilegedCreations(), 0);
  assertEquals(state.audits, []);
});
