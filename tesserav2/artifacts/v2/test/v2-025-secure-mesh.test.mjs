import assert from "node:assert/strict";
import test from "node:test";
import { SecureMesh, makeGroupKey } from "../../../preview/src/lib/secure-mesh/secure-mesh.ts";

test("a secure-mesh message decrypts, and a bad signature is rejected", () => {
  const key = makeGroupKey();
  const alice = new SecureMesh(key);
  const bob = new SecureMesh(key);
  bob.addPeer(alice.asPeer());
  const envelope = alice.encrypt("pages", "hello mesh");
  const opened = bob.decrypt(envelope);
  assert.equal(opened.ok, true);
  if (opened.ok) assert.equal(opened.text, "hello mesh");

  const broken = alice.encrypt("pages", "hello mesh");
  const sig = Buffer.from(broken.sig, "base64");
  sig[0] ^= 0xff;
  broken.sig = sig.toString("base64");
  const refused = bob.decrypt(broken);
  assert.deepEqual(refused, { ok: false, reason: "bad-signature" });
  assert.ok(bob.quarantine.length >= 1);
});
