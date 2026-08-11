import { createSupabaseContext } from "npm:@supabase/server@1.4.1";
import {
  getGoogleAccessToken,
  parseFirebaseServiceAccount,
  sendFcmReminder,
} from "./fcm.ts";
import { mondayOf } from "./reminder.ts";
import { runWeeklyCheckinReminder } from "./orchestrator.ts";
import { type RpcClient, SupabaseReminderRepository } from "./repository.ts";

interface ContextError {
  status: number;
  code: string;
  message: string;
}

interface AuthenticatedContext {
  supabaseAdmin: RpcClient;
}

interface ContextResult {
  data: AuthenticatedContext | null;
  error: ContextError | null;
}

type ContextFactory = (request: Request) => Promise<ContextResult>;

export interface HandlerDependencies {
  createContext?: ContextFactory;
  getServiceAccountJson?: () => string | undefined;
  fetch?: typeof fetch;
  now?: () => Date;
  randomUuid?: () => string;
}

async function officialContext(request: Request): Promise<ContextResult> {
  const { data, error } = await createSupabaseContext(request, {
    auth: "secret:automations",
  });
  return {
    data: data
      ? { supabaseAdmin: data.supabaseAdmin as unknown as RpcClient }
      : null,
    error: error
      ? { status: error.status, code: error.code, message: error.message }
      : null,
  };
}

function json(
  status: number,
  value: unknown,
  headers: HeadersInit = {},
): Response {
  return Response.json(value, { status, headers });
}

export function parseReminderRequest(
  value: unknown,
  now: Date,
): { week: string } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "week_of")) return null;
  const currentWeek = mondayOf(now);
  if (record.week_of === undefined) return { week: currentWeek };
  if (
    typeof record.week_of !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.week_of)
  ) return null;
  const date = new Date(`${record.week_of}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== record.week_of
  ) return null;
  if (date.getUTCDay() !== 1 || record.week_of > currentWeek) return null;
  return { week: record.week_of };
}

export function createWeeklyCheckinReminderHandler(
  dependencies: HandlerDependencies = {},
): (request: Request) => Promise<Response> {
  const createContext = dependencies.createContext ?? officialContext;
  const fetchImpl = dependencies.fetch ?? fetch;

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return json(405, { error: "method_not_allowed" }, { Allow: "POST" });
    }

    const { data: context, error: authError } = await createContext(request);
    if (authError || !context) {
      return json(authError?.status ?? 401, {
        error: authError?.code ?? "INVALID_CREDENTIALS",
        message: authError?.message ?? "Invalid credentials",
      });
    }

    try {
      const requestText = await request.text();
      let requestBody: unknown = {};
      if (requestText.trim()) {
        try {
          requestBody = JSON.parse(requestText);
        } catch {
          return json(400, { error: "invalid_request" });
        }
      }
      const now = dependencies.now?.() ?? new Date();
      const parsedRequest = parseReminderRequest(requestBody, now);
      if (!parsedRequest) return json(400, { error: "invalid_request" });

      const serviceAccount = parseFirebaseServiceAccount(
        dependencies.getServiceAccountJson?.() ??
          Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON"),
      );
      const accessToken = await getGoogleAccessToken(
        serviceAccount,
        fetchImpl,
        now,
      );
      const repository = new SupabaseReminderRepository(context.supabaseAdmin);
      const outcome = await runWeeklyCheckinReminder({
        repository,
        send: (token) =>
          sendFcmReminder(
            serviceAccount.project_id,
            accessToken,
            token,
            fetchImpl,
          ),
        now: dependencies.now,
        randomUuid: dependencies.randomUuid,
        week: parsedRequest.week,
      });
      return json(
        ["pending", "retryable"].includes(outcome.status) ? 202 : 200,
        outcome,
      );
    } catch (error) {
      console.error(
        "weekly-checkin-reminder failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return json(500, { error: "reminder_failed" });
    }
  };
}

if (import.meta.main) {
  Deno.serve(createWeeklyCheckinReminderHandler());
}
