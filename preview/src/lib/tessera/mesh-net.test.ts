import assert from "node:assert/strict";
import test from "node:test";
import { MESH, meshDrop, meshProject } from "./mesh-net.ts";

test("the mesh is readable with no web and a drop still needs approval", () => {
  assert.equal(MESH.needsWeb, false);
  assert.equal(MESH.carriedBy, "git");
  const project = meshProject("admit");
  assert.equal(project?.run, "node admit.mjs");
  assert.equal(meshProject("house")?.does.startsWith("Tessera keeps the chair"), true);
  assert.match(meshProject("pass")?.does ?? "", /not a key/i);
  assert.match(meshProject("local-vault")?.does ?? "", /unencrypted/);
  assert.equal(meshProject("missing"), null);
  assert.equal(meshDrop("Ada", "Tessera", "I can fix the sort.", false).ok, false);
  const sent = meshDrop("Ada", "Tessera", "I can fix the sort.", true);
  assert.equal(sent.ok, true);
  if (sent.ok) assert.equal(sent.drop.to, "Tessera");
  assert.equal(meshDrop("Ada", "Tessera", "Pay the wallet in Monero.", true).ok, false);
});
