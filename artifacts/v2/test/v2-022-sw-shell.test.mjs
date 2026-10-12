import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { emitServiceWorker, navigateOffline } from "../src/offline/sw-shell.mjs";

test("sw.js is emitted and offline navigation returns the shell", () => {
  const dir = mkdtempSync(join(tmpdir(), "v2-sw-"));
  try {
    const emitted = emitServiceWorker(dir);
    const source = readFileSync(emitted.swPath, "utf8");
    assert.match(source, /offline-shell\.html/);
    assert.match(source, /caches\.match\(SHELL\)/);
    const shell = readFileSync(emitted.shellPath, "utf8");
    assert.match(shell, /id="offline-shell"/);
    const offline = navigateOffline({ online: false, path: "/studio" });
    assert.equal(offline.shell, true);
    assert.match(offline.html, /id="offline-shell"/);
    assert.equal(navigateOffline({ online: true, path: "/studio" }).shell, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
