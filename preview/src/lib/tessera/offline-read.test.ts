import assert from "node:assert/strict";
import test from "node:test";
import { readCarried } from "./offline-read.ts";

test("a carried page is read with no fetch, and a missing page stays missing", () => {
  const page = { path: "mesh/index.json", text: "admit carry spin", stamp: "2026-10-19" };
  const hit = readCarried([page], "admit carry");
  assert.match(hit.text, /^Carried 2026-10-19\./);
  assert.equal(hit.fetches, 0);
  assert.equal(hit.tokens, 0);
  assert.equal(hit.waited, 0);
  assert.equal(hit.usedIp, false);
  assert.equal(hit.usedWeb, false);
  assert.equal(hit.assembled, false);
  assert.equal(hit.live, false);
  const miss = readCarried([page], "live weather");
  assert.equal(miss.text, "Not carried.");
  assert.equal(miss.live, false);
  assert.equal(miss.fetches, 0);
});
