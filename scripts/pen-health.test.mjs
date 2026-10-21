import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = join(root, "scripts", "pen-health.mjs");

test("pen health stays off and checks loopback without touching enable flags", () => {
  const source = readFileSync(scriptPath, "utf8");
  assert.doesNotMatch(source, /TESSERA_ENABLE_[A-Z0-9_]*\s*=/);
  assert.doesNotMatch(source, /process\.env\.TESSERA_PEN_ENABLED\s*=/);
  assert.doesNotMatch(source, /process\.env\.TESSERA_PEN_LOCAL\s*=/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);

  const child = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    env: { ...process.env, TESSERA_PEN_ENABLED: "1", TESSERA_PEN_LOCAL: "1" },
    encoding: "utf8",
  });
  assert.equal(child.status, 0, child.stderr);
  const summary = JSON.parse(child.stdout);
  assert.equal(summary.label, "TESTED");
  assert.equal(summary.network, false);
  assert.equal(summary.parent_flag_names_unchanged, true);
  assert.equal(summary.parent_tessera_pen_enabled_is_set, true);
  assert.equal(summary.parent_tessera_pen_local_is_set, true);
  assert.equal(summary.child_exit, 0);
  assert.equal(summary.child.hosted_pen_enabled_in_child_env, false);
  assert.equal(summary.child.local_pen_enabled_in_child_env, false);
  assert.deepEqual(summary.child.child_tessera_enable_names, []);
  assert.equal(summary.child.default_local_url, "http://127.0.0.1:8765");
  assert.equal(summary.child.local_chat_path, "/v1/chat/completions");
  assert.equal(summary.child.hosted_loopback_base, "http://127.0.0.1:8765/v1");
  assert.equal(summary.child.hosted_chat_suffix, "/chat/completions");
  assert.equal(summary.child.hosted_refuses_public_openai, true);
  assert.equal(summary.child.process_env_mutated, false);
});
