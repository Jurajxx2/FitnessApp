import {
  type AdminAuditEvent,
  type AdminAuditRequestState,
  type AdminAuditWriteResult,
  type AdminAuthorizationResult,
  type AdminSecurityEnvironment,
  authorizationResponse,
  authorizeAdminRequest,
  createServiceOperations,
  requestIdFromHeaders,
} from "../_shared/admin-security.ts";
import { type AdminUserAction, parseAdminUserRequest } from "./logic.ts";
import {
  type DeletionServiceResult,
  readUserDeletion,
  startOrAdvanceUserDeletion,
} from "./deletion-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type ProfileAccountAction = Exclude<AdminUserAction, "delete">;
export type ProfileActionResult =
  | "updated"
  | "target_not_found"
  | "admin_target_denied"
  | "target_changed"
  | "invalid_action"
  | "operation_failed";

export interface AdminManageUserDependencies {
  authorize(authorization: string | null): Promise<AdminAuthorizationResult>;
  createPrivilegedOperations(): {
    applyProfileAction(
      userId: string,
      action: ProfileAccountAction,
    ): Promise<ProfileActionResult>;
    recordAudit(event: AdminAuditEvent): Promise<AdminAuditWriteResult>;
    readAuditRequest(input: {
      actorUserId: string;
      action: AdminUserAction;
      requestId: string;
    }): Promise<AdminAuditRequestState>;
    advanceDeletion(
      userId: string,
      actorUserId: string,
    ): Promise<DeletionServiceResult>;
    readDeletion(userId: string): Promise<DeletionServiceResult>;
  };
  requestId(headers: Headers): string;
}

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function actionError(action: AdminUserAction): string {
  switch (action) {
    case "block":
      return "Unable to disable the user";
    case "unblock":
      return "Unable to activate the user";
    case "promote_admin":
      return "Unable to grant admin access";
    case "delete":
      return "Unable to delete the user";
  }
}

function sanitizedDeletionErrorCode(value?: string): string | undefined {
  if (!value) return undefined;
  return /^[a-z][a-z0-9_]{0,63}$/.test(value)
    ? value
    : "deletion_operation_failed";
}

async function persistAudit(
  recordAudit: (
    event: AdminAuditEvent,
  ) => Promise<AdminAuditWriteResult>,
  event: AdminAuditEvent,
): Promise<AdminAuditWriteResult | "unavailable"> {
  try {
    return await recordAudit(event);
  } catch {
    console.error("Unable to persist admin security audit", {
      requestId: event.requestId,
      action: event.action,
      outcome: event.outcome,
    });
    return "unavailable";
  }
}

export function createAdminManageUserHandler(
  dependencies: AdminManageUserDependencies,
) {
  const handle = async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authorization = await dependencies.authorize(
      req.headers.get("Authorization"),
    );
    if (!authorization.ok) {
      const response = authorizationResponse(authorization);
      return json(await response.json(), response.status);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Request body must be valid JSON" }, 400);
    }
    const parsed = parseAdminUserRequest(body);
    if (!parsed) {
      return json({ error: "Provide a valid action and user id" }, 400);
    }
    const targetUserId = parsed.userId;

    const requestId = dependencies.requestId(req.headers);
    const operations = dependencies.createPrivilegedOperations();
    const finish = async (
      outcome: "success" | "failure",
      status: number,
      responseBody: Record<string, unknown>,
      options: {
        reason?: string;
        jobId?: string;
        deletionStatus?: string;
        errorCode?: string;
      } = {},
    ): Promise<Response> => {
      const recorded = await persistAudit(
        operations.recordAudit,
        {
          actorUserId: authorization.actorUserId,
          targetUserId: parsed.userId,
          action: parsed.action,
          outcome,
          requestId,
          ...(options.jobId ? { jobId: options.jobId } : {}),
          detail: {
            ...(options.reason ? { reason: options.reason } : {}),
            ...(options.deletionStatus
              ? { status: options.deletionStatus }
              : {}),
            ...(options.errorCode ? { error_code: options.errorCode } : {}),
          },
          response: { status, body: responseBody },
        },
      );
      if (recorded === "recorded") return json(responseBody, status);
      if (recorded === "duplicate") {
        try {
          const state = await operations.readAuditRequest({
            actorUserId: authorization.actorUserId,
            action: parsed.action,
            requestId,
          });
          if (
            state.attemptTargetUserId === parsed.userId &&
            state.terminal?.targetUserId === parsed.userId
          ) return json(state.terminal.body, state.terminal.status);
        } catch {
          // Fall through to the fail-closed audit response below.
        }
      }
      return json({ error: "Unable to record the account action" }, 500);
    };

    const attemptAudit = await persistAudit(
      operations.recordAudit,
      {
        actorUserId: authorization.actorUserId,
        targetUserId: parsed.userId,
        action: parsed.action,
        outcome: "attempt",
        requestId,
        ...(parsed.action === "delete" ? { jobId: parsed.userId } : {}),
        detail: { stage: "mutation_requested" },
      },
    );
    if (attemptAudit === "unavailable") {
      return json({ error: "Unable to record the account action" }, 500);
    }
    if (attemptAudit === "duplicate") {
      let state: AdminAuditRequestState;
      try {
        state = await operations.readAuditRequest({
          actorUserId: authorization.actorUserId,
          action: parsed.action,
          requestId,
        });
      } catch {
        return json({ error: "Unable to reconcile the account action" }, 500);
      }
      if (state.attemptTargetUserId !== parsed.userId) {
        return json(
          { error: "Idempotency key belongs to another target" },
          409,
        );
      }
      if (state.terminal) {
        if (state.terminal.targetUserId !== parsed.userId) {
          return json(
            { error: "Idempotency key belongs to another target" },
            409,
          );
        }
        return json(state.terminal.body, state.terminal.status);
      }
      if (parsed.action === "delete") {
        if (parsed.userId === authorization.actorUserId) {
          return await finish(
            "failure",
            409,
            { error: "You cannot change your own account access" },
            { reason: "self_action_denied", jobId: parsed.userId },
          );
        }
        let deletion: DeletionServiceResult;
        try {
          deletion = await operations.readDeletion(parsed.userId);
        } catch {
          deletion = {
            ok: false,
            httpStatus: 500,
            jobId: parsed.userId,
            errorCode: "deletion_replay_failed",
          };
        }
        if (
          !deletion.ok && deletion.httpStatus === 202 &&
          deletion.errorCode === "deletion_job_pending"
        ) {
          return json({
            status: "pending",
            error: "This account action is still being reconciled",
            requestId,
          }, 202);
        }
        return await finishDeletion(deletion);
      }
      return json({
        status: "pending",
        error: "This account action is still being reconciled",
        requestId,
      }, 202);
    }

    if (parsed.userId === authorization.actorUserId) {
      return await finish(
        "failure",
        409,
        { error: "You cannot change your own account access" },
        {
          reason: "self_action_denied",
          ...(parsed.action === "delete" ? { jobId: parsed.userId } : {}),
        },
      );
    }

    async function finishDeletion(
      deletion: DeletionServiceResult,
    ): Promise<Response> {
      const jobId = deletion.deletion?.jobId ?? deletion.jobId ?? targetUserId;
      if (!deletion.ok || !deletion.deletion) {
        const status = deletion.httpStatus;
        const errorCode = sanitizedDeletionErrorCode(deletion.errorCode) ??
          (status === 404 ? "target_not_found" : "deletion_operation_failed");
        const body = {
          error: status === 404 ? "User not found" : actionError("delete"),
        };
        return await finish("failure", status, body, {
          reason: status === 404
            ? "target_not_found"
            : "deletion_operation_failed",
          jobId,
          errorCode,
        });
      }
      const errorCode = sanitizedDeletionErrorCode(
        deletion.deletion.errorCode,
      );
      const { errorCode: _unsafeErrorCode, ...safeDeletion } =
        deletion.deletion;
      const deletionBody = {
        ...safeDeletion,
        ...(errorCode ? { errorCode } : {}),
      };
      const responseBody = {
        action: "delete",
        userId: targetUserId,
        deletion: deletionBody,
      };
      const failed = deletion.deletion.status === "manual_review" ||
        deletion.deletion.status === "retryable_error";
      return await finish(
        failed ? "failure" : "success",
        deletion.httpStatus,
        responseBody,
        {
          reason: failed
            ? deletion.deletion.status === "manual_review"
              ? "deletion_manual_review"
              : "deletion_retryable_error"
            : undefined,
          jobId,
          deletionStatus: deletion.deletion.status,
          errorCode,
        },
      );
    }

    if (parsed.action === "delete") {
      let deletion: DeletionServiceResult;
      try {
        deletion = await operations.advanceDeletion(
          parsed.userId,
          authorization.actorUserId,
        );
      } catch {
        deletion = {
          ok: false,
          httpStatus: 500,
          jobId: parsed.userId,
          errorCode: "deletion_operation_failed",
        };
      }
      return await finishDeletion(deletion);
    }

    let operationResult: ProfileActionResult;
    try {
      operationResult = await operations.applyProfileAction(
        parsed.userId,
        parsed.action,
      );
    } catch {
      operationResult = "operation_failed";
    }

    if (operationResult === "target_not_found") {
      return await finish(
        "failure",
        404,
        { error: "User not found" },
        { reason: "target_not_found" },
      );
    }
    if (
      operationResult === "admin_target_denied" ||
      operationResult === "target_changed"
    ) {
      return await finish(
        "failure",
        409,
        { error: "Existing admin accounts cannot be changed here" },
        { reason: "admin_target_denied" },
      );
    }
    if (operationResult !== "updated") {
      return await finish(
        "failure",
        400,
        { error: actionError(parsed.action) },
        { reason: "account_operation_failed" },
      );
    }

    return await finish(
      "success",
      200,
      { action: parsed.action, userId: parsed.userId },
    );
  };

  // Outermost boundary. Every early return and inner catch above resolves
  // normally through handle(), so this only fires on a thrown exception and
  // can never turn a returned 4xx into a 500. Without it a throw from
  // dependencies.authorize would reject the handler promise and Edge Runtime
  // would emit a bare 500 with no CORS headers, which the browser reports as
  // an opaque network failure instead of this JSON error.
  return async (req: Request): Promise<Response> => {
    try {
      return await handle(req);
    } catch (error) {
      console.error("admin-manage-user failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return json({ error: "Unable to manage the user" }, 500);
    }
  };
}

function readEnvironment(): AdminSecurityEnvironment | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey
    ? { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey }
    : null;
}

export function createProductionAdminManageUserHandler(): (
  req: Request,
) => Promise<Response> {
  const environment = readEnvironment();
  if (!environment) {
    return () => {
      console.error("Supabase environment is not configured");
      return Promise.resolve(
        json({ error: "Service is not configured" }, 500),
      );
    };
  }

  return createAdminManageUserHandler({
    authorize: (authorization) =>
      authorizeAdminRequest(environment, authorization),
    requestId: requestIdFromHeaders,
    createPrivilegedOperations: () => {
      const operations = createServiceOperations(environment);
      return {
        recordAudit: operations.recordAudit,
        readAuditRequest: operations.readAuditRequest,
        advanceDeletion: (userId, actorUserId) =>
          startOrAdvanceUserDeletion(
            operations.client(),
            userId,
            actorUserId,
          ),
        readDeletion: (userId) => readUserDeletion(operations.client(), userId),
        async applyProfileAction(userId, action) {
          const { data, error } = await operations.client().rpc(
            "admin_apply_profile_account_action",
            { p_user_id: userId, p_action: action },
          );
          if (error) return "operation_failed";
          return typeof data === "string"
            ? data as ProfileActionResult
            : "operation_failed";
        },
      };
    },
  });
}

if (import.meta.main) Deno.serve(createProductionAdminManageUserHandler());
