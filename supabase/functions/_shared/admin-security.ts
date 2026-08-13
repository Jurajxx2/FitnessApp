import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type AdminAuthorizationFailure =
  | "authentication_required"
  | "mfa_required"
  | "admin_required"
  | "verification_unavailable";

export type AdminAuthorizationResult =
  | { ok: true; actorUserId: string }
  | { ok: false; reason: AdminAuthorizationFailure };

export type AdminAuditAction =
  | "invite_user"
  | "block"
  | "unblock"
  | "promote_admin"
  | "delete";

export interface AdminAuditEvent {
  actorUserId: string;
  targetUserId: string | null;
  action: AdminAuditAction;
  outcome: "attempt" | "success" | "failure";
  requestId: string;
  jobId?: string | null;
  detail?: Record<string, string | number | boolean | null>;
  response?: {
    status: number;
    body: Record<string, unknown>;
  };
}

export type AdminAuditWriteResult = "recorded" | "duplicate";

export interface AdminAuditTerminal {
  targetUserId: string | null;
  outcome: "success" | "failure";
  status: number;
  body: Record<string, unknown>;
}

export interface AdminAuditRequestState {
  attemptTargetUserId: string | null;
  terminal: AdminAuditTerminal | null;
}

export interface AdminSecurityEnvironment {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
}

interface JwtPayload {
  aal?: unknown;
}

export function hasAdminMfaAccess(input: {
  assuranceLevel: "aal1" | "aal2" | null;
  isAdmin: boolean | null | undefined;
  isBlocked: boolean | null | undefined;
}): boolean {
  return input.assuranceLevel === "aal2" && input.isAdmin === true &&
    input.isBlocked === false;
}

export function accessTokenFromAuthorization(
  value: string | null,
): string | null {
  if (!value) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

/** Decode only after auth.getUser(token) has validated this exact token. */
export function assuranceLevelFromValidatedJwt(
  token: string,
): "aal1" | "aal2" | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
    const payload = JSON.parse(atob(base64)) as JwtPayload;
    return payload.aal === "aal1" || payload.aal === "aal2"
      ? payload.aal
      : null;
  } catch {
    return null;
  }
}

export function requestIdFromHeaders(headers: Headers): string {
  const supplied = headers.get("x-request-id")?.trim();
  if (supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)) return supplied;
  return crypto.randomUUID();
}

export async function authorizeAdminRequest(
  environment: Pick<
    AdminSecurityEnvironment,
    "supabaseUrl" | "supabaseAnonKey"
  >,
  authorization: string | null,
): Promise<AdminAuthorizationResult> {
  const accessToken = accessTokenFromAuthorization(authorization);
  if (!accessToken) return { ok: false, reason: "authentication_required" };

  const callerClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const { data: { user }, error: userError } = await callerClient.auth.getUser(
    accessToken,
  );
  if (userError || !user) {
    return { ok: false, reason: "authentication_required" };
  }

  if (assuranceLevelFromValidatedJwt(accessToken) !== "aal2") {
    return { ok: false, reason: "mfa_required" };
  }

  const { data: profileData, error: profileError } = await callerClient
    .from("profiles")
    .select("is_admin, is_blocked")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return { ok: false, reason: "verification_unavailable" };
  const profile = profileData as {
    is_admin: boolean;
    is_blocked: boolean;
  } | null;
  if (
    !hasAdminMfaAccess({
      assuranceLevel: "aal2",
      isAdmin: profile?.is_admin,
      isBlocked: profile?.is_blocked,
    })
  ) return { ok: false, reason: "admin_required" };

  // The invoker-context RPC evaluates the exact bearer token against the
  // central DB predicate too. The explicit profile check above keeps the Edge
  // Functions safe during the staged window before DB enforcement is applied.
  const { data: isAdmin, error: authorityError } = await callerClient.rpc(
    "get_is_admin",
  );
  if (authorityError) return { ok: false, reason: "verification_unavailable" };
  if (isAdmin !== true) return { ok: false, reason: "admin_required" };

  return { ok: true, actorUserId: user.id };
}

export function createServiceOperations(environment: AdminSecurityEnvironment) {
  // This closure is created after authorization by each handler. The client is
  // initialized lazily and never exists on an unauthorized request path.
  let serviceClient: ReturnType<typeof createClient> | null = null;
  const client = () => {
    serviceClient ??= createClient(
      environment.supabaseUrl,
      environment.supabaseServiceRoleKey,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    return serviceClient;
  };

  return {
    client,
    async readAuditRequest(input: {
      actorUserId: string;
      action: AdminAuditAction;
      requestId: string;
    }): Promise<AdminAuditRequestState> {
      const { data, error } = await client()
        .from("admin_security_audit")
        .select("target_user_id, outcome, response_status, response_body")
        .eq("actor_user_id", input.actorUserId)
        .eq("action", input.action)
        .eq("request_id", input.requestId);
      if (error) {
        throw new Error(`audit_lookup_failed:${error.code ?? "unknown"}`);
      }
      const rows = Array.isArray(data) ? data : [];
      const attempt = rows.find((row) => row.outcome === "attempt");
      const terminal = rows.find((row) =>
        row.outcome === "success" || row.outcome === "failure"
      );
      if (!attempt) throw new Error("audit_lookup_missing_attempt");
      if (!terminal) {
        return {
          attemptTargetUserId: typeof attempt.target_user_id === "string"
            ? attempt.target_user_id
            : null,
          terminal: null,
        };
      }
      const terminalOutcome = terminal.outcome;
      if (terminalOutcome !== "success" && terminalOutcome !== "failure") {
        throw new Error("audit_lookup_invalid_outcome");
      }
      if (
        typeof terminal.response_status !== "number" ||
        typeof terminal.response_body !== "object" ||
        terminal.response_body === null ||
        Array.isArray(terminal.response_body)
      ) throw new Error("audit_lookup_invalid_terminal");
      return {
        attemptTargetUserId: typeof attempt.target_user_id === "string"
          ? attempt.target_user_id
          : null,
        terminal: {
          targetUserId: typeof terminal.target_user_id === "string"
            ? terminal.target_user_id
            : null,
          outcome: terminalOutcome,
          status: terminal.response_status,
          body: terminal.response_body as Record<string, unknown>,
        },
      };
    },
    async recordAudit(
      event: AdminAuditEvent,
    ): Promise<AdminAuditWriteResult> {
      const { error } = await client().from("admin_security_audit").insert({
        actor_user_id: event.actorUserId,
        target_user_id: event.targetUserId,
        action: event.action,
        outcome: event.outcome,
        request_id: event.requestId,
        job_id: event.jobId ?? null,
        detail: event.detail ?? {},
        response_status: event.response?.status ?? null,
        response_body: event.response?.body ?? null,
      });
      if (error) {
        if (error.code === "23505") return "duplicate";
        throw new Error(`audit_insert_failed:${error.code ?? "unknown"}`);
      }
      return "recorded";
    },
  };
}

export function authorizationResponse(
  result: Exclude<AdminAuthorizationResult, { ok: true }>,
): Response {
  switch (result.reason) {
    case "authentication_required":
      return Response.json({ error: "Authentication required" }, {
        status: 401,
      });
    case "mfa_required":
      return Response.json({ error: "Admin MFA verification required" }, {
        status: 403,
      });
    case "admin_required":
      return Response.json({ error: "Admin access required" }, { status: 403 });
    case "verification_unavailable":
      return Response.json({ error: "Unable to verify permissions" }, {
        status: 500,
      });
  }
}
