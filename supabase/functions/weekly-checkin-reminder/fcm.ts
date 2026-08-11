const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export interface FirebaseServiceAccount {
  project_id: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
}

export interface FcmDeliveryResult {
  status: "sent" | "retryable" | "permanent_failed";
  message_name?: string;
  error_code?: string;
  error_message?: string;
}

type Fetch = typeof fetch;

interface GoogleAccessToken {
  value: string;
  expiresAtMs: number;
}

const accessTokenCache = new Map<string, GoogleAccessToken>();
const accessTokenRequests = new Map<string, Promise<GoogleAccessToken>>();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(
    /=+$/,
    "",
  );
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodePkcs8Pem(pem: string): ArrayBuffer {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replaceAll(/\s/g, "");
  if (!body) throw new Error("Firebase service-account private key is empty");

  try {
    const binary = atob(body);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
  } catch {
    throw new Error(
      "Firebase service-account private key is not valid PKCS#8 PEM",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFirebaseServiceAccount(
  raw: string | undefined,
): FirebaseServiceAccount {
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  if (!isRecord(value) || value.type !== "service_account") {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON must contain a service account",
    );
  }

  const projectId = value.project_id;
  const clientEmail = value.client_email;
  const privateKey = value.private_key;
  const privateKeyId = value.private_key_id;
  if (
    typeof projectId !== "string" ||
    !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId) ||
    typeof clientEmail !== "string" ||
    !clientEmail.endsWith(".gserviceaccount.com") ||
    typeof privateKey !== "string" ||
    !privateKey.includes("-----BEGIN PRIVATE KEY-----") ||
    (privateKeyId !== undefined && typeof privateKeyId !== "string")
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing required service-account fields",
    );
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
    ...(privateKeyId ? { private_key_id: privateKeyId } : {}),
  };
}

export async function mintGoogleAccessToken(
  serviceAccount: FirebaseServiceAccount,
  fetchImpl: Fetch = fetch,
  now: Date = new Date(),
): Promise<GoogleAccessToken> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
    ...(serviceAccount.private_key_id
      ? { kid: serviceAccount.private_key_id }
      : {}),
  };
  const claims = {
    iss: serviceAccount.client_email,
    scope: FCM_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  const unsignedJwt = `${encodeJson(header)}.${encodeJson(claims)}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodePkcs8Pem(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJwt),
  );
  const assertion = `${unsignedJwt}.${base64Url(new Uint8Array(signature))}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const responseBody = await response.json().catch(() => null);
  if (
    !response.ok || !isRecord(responseBody) ||
    typeof responseBody.access_token !== "string" ||
    typeof responseBody.expires_in !== "number" || responseBody.expires_in <= 60
  ) {
    const error =
      isRecord(responseBody) && typeof responseBody.error === "string"
        ? responseBody.error
        : `http_${response.status}`;
    throw new Error(`Google OAuth token exchange failed: ${error}`);
  }

  return {
    value: responseBody.access_token,
    expiresAtMs: now.getTime() + responseBody.expires_in * 1000,
  };
}

export async function getGoogleAccessToken(
  serviceAccount: FirebaseServiceAccount,
  fetchImpl: Fetch = fetch,
  now: Date = new Date(),
): Promise<string> {
  const cacheKey =
    `${serviceAccount.project_id}/${serviceAccount.client_email}/${
      serviceAccount.private_key_id ?? "default"
    }`;
  const cached = accessTokenCache.get(cacheKey);
  if (cached && cached.expiresAtMs - 60_000 > now.getTime()) {
    return cached.value;
  }

  let request = accessTokenRequests.get(cacheKey);
  if (!request) {
    request = mintGoogleAccessToken(serviceAccount, fetchImpl, now);
    accessTokenRequests.set(cacheKey, request);
  }
  try {
    const minted = await request;
    accessTokenCache.set(cacheKey, minted);
    return minted.value;
  } finally {
    if (accessTokenRequests.get(cacheKey) === request) {
      accessTokenRequests.delete(cacheKey);
    }
  }
}

function safeFcmError(
  body: unknown,
  status: number,
): { code: string; message: string } {
  if (!isRecord(body) || !isRecord(body.error)) {
    return { code: `http_${status}`, message: "FCM request failed" };
  }

  const rawCode = typeof body.error.status === "string"
    ? body.error.status
    : `http_${status}`;
  const rawMessage = typeof body.error.message === "string"
    ? body.error.message
    : "FCM request failed";
  return { code: rawCode.slice(0, 120), message: rawMessage.slice(0, 500) };
}

function failureStatus(
  httpStatus: number,
  code: string,
): "retryable" | "permanent_failed" {
  if (httpStatus === 429 || httpStatus >= 500) return "retryable";
  if (["UNAVAILABLE", "INTERNAL", "RESOURCE_EXHAUSTED"].includes(code)) {
    return "retryable";
  }
  if (["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"].includes(code)) {
    return "permanent_failed";
  }
  // Authentication/configuration failures can be repaired before a later run;
  // do not permanently discard every recipient because one OAuth setup was bad.
  return "retryable";
}

export async function sendFcmReminder(
  projectId: string,
  accessToken: string,
  deviceToken: string,
  fetchImpl: Fetch = fetch,
): Promise<FcmDeliveryResult> {
  try {
    const response = await fetchImpl(
      `https://fcm.googleapis.com/v1/projects/${
        encodeURIComponent(projectId)
      }/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: {
              title: "Weekly check-in",
              body: "How did your week go? Tap to complete your check-in.",
            },
            data: { screen: "check_in" },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const responseBody = await response.json().catch(() => null);
    if (
      response.ok && isRecord(responseBody) &&
      typeof responseBody.name === "string"
    ) {
      return { status: "sent", message_name: responseBody.name };
    }

    const error = safeFcmError(responseBody, response.status);
    return {
      status: failureStatus(response.status, error.code),
      error_code: error.code,
      error_message: error.message,
    };
  } catch (error) {
    return {
      status: "retryable",
      error_code: "network_error",
      error_message: error instanceof Error
        ? error.message.slice(0, 500)
        : "FCM network request failed",
    };
  }
}
