import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  accessTokenFromAuthorization,
  assuranceLevelFromValidatedJwt,
  hasAdminMfaAccess,
  requestIdFromHeaders,
} from "./admin-security.ts";

function token(payload: object): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `header.${encoded}.signature`;
}

Deno.test("requires one exact bearer access token", () => {
  assertEquals(
    accessTokenFromAuthorization("Bearer signed.jwt.value"),
    "signed.jwt.value",
  );
  assertEquals(
    accessTokenFromAuthorization("bearer signed.jwt.value"),
    "signed.jwt.value",
  );
  assertEquals(accessTokenFromAuthorization("Bearer one two"), null);
  assertEquals(accessTokenFromAuthorization("signed.jwt.value"), null);
  assertEquals(accessTokenFromAuthorization(null), null);
});

Deno.test("reads AAL only from a token that the caller has already validated", () => {
  assertEquals(assuranceLevelFromValidatedJwt(token({ aal: "aal2" })), "aal2");
  assertEquals(assuranceLevelFromValidatedJwt(token({ aal: "aal1" })), "aal1");
  assertEquals(assuranceLevelFromValidatedJwt(token({ aal: "aal3" })), null);
  assertEquals(assuranceLevelFromValidatedJwt("malformed"), null);
});

Deno.test("admin authority matrix rejects athlete, aal1, and blocked admin", () => {
  assertEquals(
    hasAdminMfaAccess({
      assuranceLevel: "aal2",
      isAdmin: true,
      isBlocked: false,
    }),
    true,
  );
  assertEquals(
    hasAdminMfaAccess({
      assuranceLevel: "aal2",
      isAdmin: false,
      isBlocked: false,
    }),
    false,
  );
  assertEquals(
    hasAdminMfaAccess({
      assuranceLevel: "aal1",
      isAdmin: true,
      isBlocked: false,
    }),
    false,
  );
  assertEquals(
    hasAdminMfaAccess({
      assuranceLevel: "aal2",
      isAdmin: true,
      isBlocked: true,
    }),
    false,
  );
  assertEquals(
    hasAdminMfaAccess({
      assuranceLevel: null,
      isAdmin: true,
      isBlocked: false,
    }),
    false,
  );
});

Deno.test("accepts only bounded non-sensitive request ids", () => {
  assertEquals(
    requestIdFromHeaders(new Headers({ "x-request-id": "edge:req-123" })),
    "edge:req-123",
  );
  const generated = requestIdFromHeaders(
    new Headers({ "x-request-id": "bad request id" }),
  );
  assertNotEquals(generated, "bad request id");
  assert(generated.length > 0);
});
