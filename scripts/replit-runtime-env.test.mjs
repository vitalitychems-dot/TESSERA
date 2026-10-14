import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const adapter = fileURLToPath(new URL("./replit-runtime-env.mjs", import.meta.url));
function runAdapter(adminKey) {
  // No live credentials enter this subprocess or its output.
  const result = spawnSync(process.execPath, [
    "--import", adapter, "--input-type=module", "-e",
    "console.log(JSON.stringify({db:!!process.env.DATABASE_URL,aliased:process.env.SOVEREIGN_SESSION_SECRET===process.env.SESSION_SECRET,rick:process.env.TESSERA_ENABLE_RICK_LOOP,fallback:process.env.TESSERA_PORT_FALLBACK}))",
  ], {
    env: {
      PATH: process.env.PATH,
      SESSION_SECRET: "synthetic-session-secret-for-tests-only",
      DATABASE_URL: "postgresql://localhost/synthetic_test_database",
      ...(adminKey === undefined ? {} : { TESSERACT_ADMIN_KEY: adminKey }),
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  return JSON.parse(result.stdout);
}
test("unconfigured owner starts setup without DB-backed engines", () => {
  assert.deepEqual(runAdapter(undefined), { db: false, aliased: true, rick: "0", fallback: "0" });
});
test("short owner key remains fail closed", () => {
  assert.equal(runAdapter("too-short").db, false);
});
test("configured owner retains the managed database connection", () => {
  assert.equal(runAdapter("synthetic-admin-key-for-tests-only").db, true);
});
