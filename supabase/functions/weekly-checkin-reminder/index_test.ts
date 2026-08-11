import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createWeeklyCheckinReminderHandler,
  parseReminderRequest,
} from "./index.ts";

Deno.test("parseReminderRequest defaults to current week and permits a prior Monday retry", () => {
  const now = new Date("2026-08-11T12:00:00Z");
  assertEquals(parseReminderRequest({}, now), { week: "2026-08-10" });
  assertEquals(parseReminderRequest({ week_of: "2026-08-03" }, now), {
    week: "2026-08-03",
  });
});

Deno.test("parseReminderRequest rejects future, non-Monday, malformed, and extra fields", () => {
  const now = new Date("2026-08-11T12:00:00Z");
  for (
    const value of [
      { week_of: "2026-08-17" },
      { week_of: "2026-08-11" },
      { week_of: "2026-02-30" },
      { week_of: 123 },
      { week_of: "2026-08-10", force: true },
    ]
  ) assertEquals(parseReminderRequest(value, now), null);
});

Deno.test("non-POST requests are rejected before authentication context creation", async () => {
  let contextCalls = 0;
  const handler = createWeeklyCheckinReminderHandler({
    createContext: () => {
      contextCalls += 1;
      return Promise.resolve({ data: null, error: null });
    },
  });
  const response = await handler(
    new Request("https://example.test", { method: "GET" }),
  );
  assertEquals(response.status, 405);
  assertEquals(response.headers.get("Allow"), "POST");
  assertEquals(contextCalls, 0);
});

Deno.test("authentication errors are returned before service-account configuration is read", async () => {
  let secretReads = 0;
  const handler = createWeeklyCheckinReminderHandler({
    createContext: () =>
      Promise.resolve({
        data: null,
        error: {
          status: 401,
          code: "INVALID_CREDENTIALS",
          message: "Invalid credentials",
        },
      }),
    getServiceAccountJson: () => {
      secretReads += 1;
      return undefined;
    },
  });
  const response = await handler(
    new Request("https://example.test", { method: "POST" }),
  );
  assertEquals(response.status, 401);
  assertEquals(await response.json(), {
    error: "INVALID_CREDENTIALS",
    message: "Invalid credentials",
  });
  assertEquals(secretReads, 0);
});
