import assert from "node:assert/strict";
import test from "node:test";
import { joinAsk } from "./join-web.ts";

test("an old checkout joins to its home and a tool card does not", () => {
  const site = joinAsk("where did fleet-moss-monarch-rapid go");
  const tool = joinAsk("install codegraph");
  const gap = joinAsk("open continue-dev continue");
  const plain = joinAsk("hello");
  assert.equal(site.connected, true);
  assert.equal(site.home, "vitality");
  assert.equal(tool.connected, false);
  assert.equal(tool.home, "tool");
  assert.equal(gap.connected, false);
  assert.equal(plain.connected, false);
  assert.equal(plain.line.includes("Nothing was fetched."), true);
});
