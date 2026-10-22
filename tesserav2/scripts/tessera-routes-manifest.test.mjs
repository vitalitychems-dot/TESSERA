import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { currentManifest } from "./tessera-routes-manifest.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "artifacts", "tessera", "public", "manus-routes.json");

test("production route manifest is derived from the active Wouter route source", () => {
  const expected = currentManifest();
  const actual = JSON.parse(readFileSync(manifestPath, "utf8"));

  assert.deepEqual(actual, expected);
  assert.ok(actual.routes.length > 80);
  assert.ok(actual.routes.some((route) => route.path === "/"));
  assert.ok(actual.routes.some((route) => route.path === "/c/:id"));
  assert.ok(actual.routes.some((route) => route.path === "/agent/:agentId"));
  assert.ok(actual.routes.some((route) => route.path === "/settings" && route.title === "Redirect to /command-center?tab=settings"));
  for (const route of actual.routes) {
    assert.match(route.path, /^\//);
    assert.ok(route.path.length <= 2048);
    assert.ok(typeof route.title === "string" && route.title.length > 0);
  }
});
