import assert from "node:assert/strict";
import { test } from "node:test";
import { identityFromSeed, idFromPub, verifySig } from "../src/identity.js";
import { cidName, makeData, verifyData } from "../src/names.js";

test("identity is deterministic from seed and the id is the hash of the public key", () => {
  const a = identityFromSeed("x");
  const b = identityFromSeed("x");
  assert.equal(a.pub, b.pub);
  assert.equal(a.id, idFromPub(a.pub));
  assert.notEqual(a.id, identityFromSeed("y").id);
  assert.ok(verifySig(a.pub, "hello", a.sign("hello")));
  assert.ok(!verifySig(a.pub, "hellO", a.sign("hello")));
  assert.ok(!verifySig("zz", "hello", a.sign("hello")));
});

test("content-addressed data verifies by hash and fails when a byte changes", () => {
  const payload = "some bytes";
  const data = makeData({ name: cidName(payload), payload });
  assert.ok(verifyData(data));
  assert.ok(!verifyData({ ...data, payload: "some byteZ" }));
  assert.throws(() => makeData({ name: cidName("other"), payload }));
});

test("publisher-owned names need the owner's signature, and nobody can publish in another namespace", () => {
  const alice = identityFromSeed("alice");
  const mallory = identityFromSeed("mallory");
  const name = `/id/${alice.id}/profile`;
  const data = makeData({ name, payload: "{\"bio\":\"hi\"}", identity: alice });
  assert.ok(verifyData(data));
  assert.ok(!verifyData({ ...data, payload: "{\"bio\":\"evil\"}" }));
  assert.throws(() => makeData({ name, payload: "x", identity: mallory }));
  const forged = { kind: "data", name, payload: "x", pub: mallory.pub, sig: mallory.sign("whatever") };
  assert.ok(!verifyData(forged));
  assert.ok(!verifyData({ kind: "data", name: "/web/example.com", payload: "x" }));
});
