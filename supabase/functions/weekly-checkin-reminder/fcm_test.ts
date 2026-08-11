import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type FirebaseServiceAccount,
  getGoogleAccessToken,
  mintGoogleAccessToken,
  parseFirebaseServiceAccount,
  sendFcmReminder,
} from "./fcm.ts";

function base64UrlJson(segment: string): Record<string, unknown> {
  const padded = segment.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(segment.length / 4) * 4,
    "=",
  );
  return JSON.parse(atob(padded));
}

function pem(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  const body = btoa(binary).match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

async function serviceAccount(): Promise<FirebaseServiceAccount> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  return {
    project_id: "coach-foska-test",
    private_key_id: "test-key-id",
    private_key: pem(
      await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
    ),
    client_email: "sender@coach-foska-test.iam.gserviceaccount.com",
  };
}

Deno.test("parseFirebaseServiceAccount rejects missing and non-service-account secrets", () => {
  assertThrows(
    () => parseFirebaseServiceAccount(undefined),
    Error,
    "not configured",
  );
  assertThrows(
    () =>
      parseFirebaseServiceAccount(JSON.stringify({ type: "authorized_user" })),
    Error,
    "service account",
  );
});

Deno.test("mintGoogleAccessToken creates a scoped RS256 assertion and exchanges it", async () => {
  const account = await serviceAccount();
  let assertion = "";
  const fetchStub = ((input: string | URL | Request, init?: RequestInit) => {
    assertEquals(String(input), "https://oauth2.googleapis.com/token");
    assertEquals(init?.method, "POST");
    const body = init?.body as URLSearchParams;
    assertEquals(
      body.get("grant_type"),
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    assertion = body.get("assertion") ?? "";
    return Promise.resolve(Response.json({
      access_token: "oauth-access-token",
      expires_in: 3600,
    }));
  }) as typeof fetch;

  const token = await mintGoogleAccessToken(
    account,
    fetchStub,
    new Date("2026-08-11T12:00:00Z"),
  );
  assertEquals(token, {
    value: "oauth-access-token",
    expiresAtMs: 1786453200000,
  });
  const [header, claims, signature] = assertion.split(".");
  assertEquals(base64UrlJson(header), {
    alg: "RS256",
    typ: "JWT",
    kid: "test-key-id",
  });
  assertEquals(base64UrlJson(claims), {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: 1786449600,
    exp: 1786453200,
  });
  assertStringIncludes(signature, "");
  assertEquals(signature.length > 100, true);
});

Deno.test("mintGoogleAccessToken rejects unsuccessful token exchanges without leaking body", async () => {
  const account = await serviceAccount();
  const fetchStub = (() =>
    Promise.resolve(Response.json(
      { error: "invalid_grant", error_description: "private detail" },
      { status: 400 },
    ))) as typeof fetch;
  await assertRejects(
    () => mintGoogleAccessToken(account, fetchStub),
    Error,
    "Google OAuth token exchange failed: invalid_grant",
  );
});

Deno.test("getGoogleAccessToken caches until sixty seconds before expiry", async () => {
  const account = await serviceAccount();
  account.private_key_id = `cache-test-${crypto.randomUUID()}`;
  let exchanges = 0;
  const fetchStub = (() => {
    exchanges += 1;
    return Promise.resolve(Response.json({
      access_token: `token-${exchanges}`,
      expires_in: 3600,
    }));
  }) as typeof fetch;
  const start = new Date("2026-08-11T12:00:00Z");
  assertEquals(
    await getGoogleAccessToken(account, fetchStub, start),
    "token-1",
  );
  assertEquals(
    await getGoogleAccessToken(
      account,
      fetchStub,
      new Date(start.getTime() + 3_500_000),
    ),
    "token-1",
  );
  assertEquals(
    await getGoogleAccessToken(
      account,
      fetchStub,
      new Date(start.getTime() + 3_541_000),
    ),
    "token-2",
  );
  assertEquals(exchanges, 2);
});

Deno.test("getGoogleAccessToken shares one in-flight token exchange", async () => {
  const account = await serviceAccount();
  account.private_key_id = `concurrent-cache-test-${crypto.randomUUID()}`;
  let exchanges = 0;
  const fetchStub = (() => {
    exchanges += 1;
    return new Promise<Response>((resolve) =>
      setTimeout(
        () =>
          resolve(
            Response.json({ access_token: "shared-token", expires_in: 3600 }),
          ),
        5,
      )
    );
  }) as typeof fetch;
  const now = new Date("2026-08-11T12:00:00Z");
  assertEquals(
    await Promise.all([
      getGoogleAccessToken(account, fetchStub, now),
      getGoogleAccessToken(account, fetchStub, now),
    ]),
    ["shared-token", "shared-token"],
  );
  assertEquals(exchanges, 1);
});

Deno.test("sendFcmReminder uses OAuth bearer token and the HTTP v1 payload", async () => {
  let captured: Record<string, unknown> | undefined;
  const fetchStub = ((input: string | URL | Request, init?: RequestInit) => {
    assertEquals(
      String(input),
      "https://fcm.googleapis.com/v1/projects/coach-foska/messages:send",
    );
    assertEquals(
      new Headers(init?.headers).get("Authorization"),
      "Bearer oauth-token",
    );
    captured = JSON.parse(String(init?.body));
    return Promise.resolve(
      Response.json({ name: "projects/coach-foska/messages/123" }),
    );
  }) as typeof fetch;
  const result = await sendFcmReminder(
    "coach-foska",
    "oauth-token",
    "device-token",
    fetchStub,
  );
  assertEquals(result, {
    status: "sent",
    message_name: "projects/coach-foska/messages/123",
  });
  assertEquals(captured, {
    message: {
      token: "device-token",
      notification: {
        title: "Weekly check-in",
        body: "How did your week go? Tap to complete your check-in.",
      },
      data: { screen: "check_in" },
    },
  });
});

Deno.test("sendFcmReminder returns a retryable persisted failure", async () => {
  const fetchStub = (() =>
    Promise.resolve(Response.json(
      { error: { status: "UNAVAILABLE", message: "try later" } },
      { status: 503 },
    ))) as typeof fetch;
  assertEquals(
    await sendFcmReminder(
      "coach-foska",
      "oauth-token",
      "device-token",
      fetchStub,
    ),
    {
      status: "retryable",
      error_code: "UNAVAILABLE",
      error_message: "try later",
    },
  );
});

Deno.test("sendFcmReminder permanently fails malformed or unregistered tokens", async () => {
  const fetchStub = (() =>
    Promise.resolve(Response.json(
      {
        error: {
          status: "UNREGISTERED",
          message: "registration token is not registered",
        },
      },
      { status: 404 },
    ))) as typeof fetch;
  assertEquals(
    await sendFcmReminder("coach-foska", "oauth-token", "bad-token", fetchStub),
    {
      status: "permanent_failed",
      error_code: "UNREGISTERED",
      error_message: "registration token is not registered",
    },
  );
});
