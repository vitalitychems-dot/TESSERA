import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const script = new URL("../../../preview/scripts/mesh-bundle.mjs", import.meta.url);
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

test("a sneakernet bundle opens to the same bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "v2-bundle-"));
  const src = join(root, "src");
  mkdirSync(join(src, "mesh"), { recursive: true });
  writeFileSync(join(src, "mesh/index.json"), JSON.stringify({ net: "gitmesh", pages: 3 }));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "vitalitychems-dot",
    GIT_AUTHOR_EMAIL: "332565808+vitalitychems-dot@users.noreply.github.com",
    GIT_COMMITTER_NAME: "vitalitychems-dot",
    GIT_COMMITTER_EMAIL: "332565808+vitalitychems-dot@users.noreply.github.com",
  };
  const git = (args) => execFileSync("git", args, { cwd: src, env });
  try {
    git(["init", "-q"]);
    git(["add", "."]);
    git(["commit", "-qm", "mesh index"]);
    const bundle = join(root, "mesh.bundle");
    const dst = join(root, "dst");
    execFileSync(process.execPath, [script.pathname, "create", src, bundle], { env });
    execFileSync(process.execPath, [script.pathname, "verify", bundle], { env });
    execFileSync(process.execPath, [script.pathname, "open", bundle, dst], { env });
    assert.equal(sha(join(dst, "mesh/index.json")), sha(join(src, "mesh/index.json")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
