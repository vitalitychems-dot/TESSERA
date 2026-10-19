import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = readFileSync(resolve(root, "artifacts/api-server/.replit-artifact/artifact.toml"), "utf8");
const runSection = manifest.split("[services.production.run]")[1]?.split("\n[")[0];
assert.ok(runSection, "API production run configuration is required");
const args = JSON.parse(runSection.match(/^args\s*=\s*(.+)$/m)?.[1] ?? "null");
assert.ok(Array.isArray(args), "Production run args must be explicit");
const preload = args[args.indexOf("--import") + 1];

test("published API resolves its preload from the repository root", () => {
  assert.equal(args[0], "node");
  assert.equal(preload, "./scripts/replit-runtime-env.mjs");
  assert.ok(existsSync(resolve(root, preload)));
});

test("published API entry matches the built artifact location", () => {
  assert.equal(args.at(-1), "./artifacts/api-server/dist/index.mjs");
  assert.ok(existsSync(resolve(root, "artifacts/api-server/build.mjs")));
});

test("the published preload preserves secret mapping and disabled capabilities", () => {
  const code = `
    import assert from "node:assert/strict";
    assert.equal(process.env.SOVEREIGN_SESSION_SECRET, process.env.SESSION_SECRET);
    for (const key of ["TESSERA_PORT_FALLBACK", "TESSERA_ENABLE_RICK_LOOP", "TESSERA_ENABLE_COLONIAL_FALLBACK"]) {
      assert.equal(process.env[key], "0");
    }
  `;
  const child = spawnSync(args[0], ["--import", preload, "--input-type=module", "--eval", code], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, SESSION_SECRET: "synthetic-runtime-adapter-test-secret" },
  });
  assert.equal(child.status, 0, child.stderr);
});
