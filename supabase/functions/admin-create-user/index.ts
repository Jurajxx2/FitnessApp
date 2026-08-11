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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InviteRequest {
  email: string;
  fullName: string;
}

interface InviteResult {
  userId: string | null;
  errorCode: string | null;
}

export interface AdminCreateUserDependencies {
  authorize(authorization: string | null): Promise<AdminAuthorizationResult>;
  createPrivilegedOperations(): {
    inviteUser(invite: InviteRequest): Promise<InviteResult>;
    recordAudit(event: AdminAuditEvent): Promise<AdminAuditWriteResult>;
    readAuditRequest(input: {
      actorUserId: string;
      action: "invite_user";
      requestId: string;
    }): Promise<AdminAuditRequestState>;
  };
  requestId(headers: Headers): string;
}

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function parseInviteRequest(body: unknown): InviteRequest | null {
  if (typeof body !== "object" || body === null) return null;

  const { email, fullName } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof fullName !== "string") return null;

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = fullName.trim().replace(/\s+/g, " ");
  if (
    !normalizedName ||
    normalizedName.length > MAX_NAME_LENGTH ||
    normalizedEmail.length > MAX_EMAIL_LENGTH ||
    !emailPattern.test(normalizedEmail)
  ) return null;

  return { email: normalizedEmail, fullName: normalizedName };
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
    // Never log the request body, target email/name, access token, or raw DB
    // error. The request id is enough to correlate server-side diagnostics.
    console.error("Unable to persist admin security audit", {
      requestId: event.requestId,
      action: event.action,
      outcome: event.outcome,
    });
    return "unavailable";
  }
}

export function createAdminCreateUserHandler(
  dependencies: AdminCreateUserDependencies,
) {
  return async (req: Request): Promise<Response> => {
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

    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return json({ error: "Request body must be valid JSON" }, 400);
    }
    const invite = parseInviteRequest(requestBody);
    if (!invite) {
      return json({
        error: "Provide a valid email address and a name up to 120 characters",
      }, 400);
    }

    const requestId = dependencies.requestId(req.headers);
    const operations = dependencies.createPrivilegedOperations();
    const auditBase = {
      actorUserId: authorization.actorUserId,
      targetUserId: null,
      action: "invite_user" as const,
      requestId,
    };
    const finish = async (
      outcome: "success" | "failure",
      status: number,
      responseBody: Record<string, unknown>,
      targetUserId: string | null,
      reason?: string,
    ): Promise<Response> => {
      const recorded = await persistAudit(operations.recordAudit, {
        ...auditBase,
        targetUserId,
        outcome,
        detail: reason ? { reason } : {},
        response: { status, body: responseBody },
      });
      return recorded === "recorded"
        ? json(responseBody, status)
        : json({ error: "Unable to record the account action" }, 500);
    };
    const attemptAudit = await persistAudit(operations.recordAudit, {
      ...auditBase,
      outcome: "attempt",
      detail: { stage: "mutation_requested" },
    });
    if (attemptAudit === "unavailable") {
      return json({ error: "Unable to record the account action" }, 500);
    }
    if (attemptAudit === "duplicate") {
      let state: AdminAuditRequestState;
      try {
        state = await operations.readAuditRequest({
          actorUserId: authorization.actorUserId,
          action: "invite_user",
          requestId,
        });
      } catch {
        return json({ error: "Unable to reconcile the account action" }, 500);
      }
      return state.terminal
        ? json(state.terminal.body, state.terminal.status)
        : json({
          status: "pending",
          error: "This invitation is still being reconciled",
          requestId,
        }, 202);
    }

    let result: InviteResult;
    try {
      result = await operations.inviteUser(invite);
    } catch {
      result = { userId: null, errorCode: "unexpected_failure" };
    }

    if (!result.userId) {
      const duplicate = result.errorCode === "email_exists" ||
        result.errorCode === "user_already_exists";
      return await finish(
        "failure",
        400,
        {
          error: duplicate
            ? "A user with this email already exists"
            : "Unable to send the invitation",
        },
        null,
        duplicate ? "duplicate_identity" : "invite_failed",
      );
    }

    return await finish(
      "success",
      201,
      { user: { id: result.userId } },
      result.userId,
    );
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

export function createProductionAdminCreateUserHandler(): (
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

  return createAdminCreateUserHandler({
    authorize: (authorization) =>
      authorizeAdminRequest(environment, authorization),
    requestId: requestIdFromHeaders,
    createPrivilegedOperations: () => {
      const operations = createServiceOperations(environment);
      return {
        recordAudit: operations.recordAudit,
        readAuditRequest: operations.readAuditRequest,
        async inviteUser(invite): Promise<InviteResult> {
          const { data, error } = await operations.client().auth.admin
            .inviteUserByEmail(invite.email, {
              data: { full_name: invite.fullName },
            });
          return {
            userId: data.user?.id ?? null,
            errorCode: error?.code ?? (data.user ? null : "missing_user"),
          };
        },
      };
    },
  });
}

if (import.meta.main) Deno.serve(createProductionAdminCreateUserHandler());
