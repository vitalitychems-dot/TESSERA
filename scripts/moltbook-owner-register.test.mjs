import test from "node:test";
import assert from "node:assert/strict";
import {
  APPROVED_MOLTBOOK_NAMES,
  registerApprovedMoltbookAgent,
  validateApprovedRegistration,
} from "./moltbook-owner-register.mjs";

test("the owner registration helper is restricted to the approved exact names", () => {
  assert.deepEqual(APPROVED_MOLTBOOK_NAMES, ["Tessera", "Atherion", "Orion", "Rick", "eistine"]);
  assert.throws(
    () => validateApprovedRegistration("Einstein", "A public project agent identity."),
    /not in the owner-approved roster/,
  );
});

test("descriptions are trimmed and bounded before any request", () => {
  assert.equal(
    validateApprovedRegistration("Tessera", "  A public TESSERA project agent identity.  "),
    "A public TESSERA project agent identity.",
  );
  assert.throws(() => validateApprovedRegistration("Tessera", "short"), /10–500/);
  assert.throws(
    () => validateApprovedRegistration("Tessera", "x".repeat(501)),
    /10–500/,
  );
});

test("registration uses the fixed HTTPS endpoint and returns only bounded credential fields", async () => {
  let observed;
  const result = await registerApprovedMoltbookAgent(
    "Tessera",
    "A public TESSERA project agent identity.",
    async (url, options) => {
      observed = { url, options };
      return new Response(JSON.stringify({
        agent: {
          api_key: "test-key-not-a-real-credential",
          claim_url: "https://www.moltbook.com/claim/test",
          verification_code: "TEST-123",
        },
      }), { status: 201, headers: { "content-type": "application/json" } });
    },
  );

  assert.equal(observed.url, "https://www.moltbook.com/api/v1/agents/register");
  assert.equal(observed.options.method, "POST");
  assert.equal(observed.options.redirect, "error");
  assert.equal(observed.options.cache, "no-store");
  assert.equal(observed.options.headers.Authorization, undefined);
  assert.equal(JSON.parse(observed.options.body).name, "Tessera");
  assert.equal(result.apiKey, "test-key-not-a-real-credential");
  assert.equal(result.claimUrl, "https://www.moltbook.com/claim/test");
  assert.equal(result.verificationCode, "TEST-123");
});

test("registration rejects unexpected claim-link hosts", async () => {
  const result = await registerApprovedMoltbookAgent(
    "Rick",
    "A public TESSERA project agent identity.",
    async () => new Response(JSON.stringify({
      api_key: "test-key-not-a-real-credential",
      claim_url: "https://attacker.invalid/claim",
      verification_code: "TEST-456",
    }), { status: 201 }),
  );
  assert.equal(result.apiKey, "test-key-not-a-real-credential");
  assert.equal(result.claimUrl, null);
});

test("unapproved names are rejected before network access", async () => {
  let called = false;
  await assert.rejects(
    () => registerApprovedMoltbookAgent("Other", "A public project agent identity.", async () => {
      called = true;
      return new Response("{}");
    }),
    /not in the owner-approved roster/,
  );
  assert.equal(called, false);
});
