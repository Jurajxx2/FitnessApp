import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSupabaseContext } from "npm:@supabase/server@1.4.1";

const AUTOMATIONS_KEY = "sb_secret_automations_test";

async function authenticate(headers: HeadersInit = {}) {
  return await createSupabaseContext(
    new Request("https://example.test/functions/v1/weekly-checkin-reminder", {
      method: "POST",
      headers,
    }),
    { auth: "secret:automations" },
  );
}

Deno.test("@supabase/server named secret auth rejects anonymous, user JWT, and wrong key", async () => {
  const originalUrl = Deno.env.get("SUPABASE_URL");
  const originalPublishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const originalSecret = Deno.env.get("SUPABASE_SECRET_KEYS");
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set(
      "SUPABASE_PUBLISHABLE_KEYS",
      JSON.stringify({ default: "sb_publishable_test" }),
    );
    Deno.env.set(
      "SUPABASE_SECRET_KEYS",
      JSON.stringify({
        default: "sb_secret_default_test",
        automations: AUTOMATIONS_KEY,
      }),
    );

    const rejectedHeaders: HeadersInit[] = [
      {},
      { Authorization: "Bearer user.jwt.value" },
      { apikey: "sb_secret_wrong" },
    ];
    for (const headers of rejectedHeaders) {
      const { data, error } = await authenticate(headers);
      assertEquals(data, null);
      assertEquals(error?.status, 401);
      assertEquals(error?.code, "INVALID_CREDENTIALS");
    }

    Deno.env.set(
      "SUPABASE_SECRET_KEYS",
      JSON.stringify({ automations: AUTOMATIONS_KEY }),
    );
    const rejectedBeforeAdminClient = await authenticate({
      apikey: "sb_secret_wrong",
    });
    assertEquals(rejectedBeforeAdminClient.error?.status, 401);
    assertEquals(rejectedBeforeAdminClient.error?.code, "INVALID_CREDENTIALS");
    Deno.env.set(
      "SUPABASE_SECRET_KEYS",
      JSON.stringify({
        default: "sb_secret_default_test",
        automations: AUTOMATIONS_KEY,
      }),
    );

    const { data, error } = await authenticate({ apikey: AUTOMATIONS_KEY });
    assertEquals(error, null);
    assert(data);
    assertEquals(data.authMode, "secret");
    assert(data.supabaseAdmin);
  } finally {
    for (
      const [key, value] of [
        ["SUPABASE_URL", originalUrl],
        ["SUPABASE_PUBLISHABLE_KEYS", originalPublishable],
        ["SUPABASE_SECRET_KEYS", originalSecret],
      ] as const
    ) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});
