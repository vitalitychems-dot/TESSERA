/**
 * Generates an obvious fake token outside the repo, proves gitleaks fails on it,
 * then proves a clean directory passes. The token is built at runtime so it is
 * not stored in the repository.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runGitleaks } from "./gitleaks-scan.mjs";

const root = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
const config = join(root, ".gitleaks.toml");

function fakeGithubPat() {
  const prefix = String.fromCharCode(103, 104, 112, 95);
  const pairs = ["A1", "b2", "C3", "d4", "E5", "f6", "G7", "h8", "I9", "j0", "K1", "l2", "M3", "n4", "O5", "p6", "Q7", "r8"];
  return prefix + pairs.join("");
}

function outsideRepo(prefix) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  assert.equal(dir.startsWith(root), false, `${dir} must stay outside the repository`);
  return dir;
}

function gitleaksBinary() {
  if (process.env.GITLEAKS_BIN) return process.env.GITLEAKS_BIN;
  const found = spawnSync("sh", ["-c", "command -v gitleaks"], { encoding: "utf8" });
  if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  const dest = outsideRepo("tessera-gitleaks-bin-");
  const installer = fileURLToPath(new URL("./install-gitleaks.sh", import.meta.url));
  const install = spawnSync("sh", [installer], {
    encoding: "utf8",
    env: { ...process.env, PREFIX: dest, GITHUB_TOKEN: "", GH_TOKEN: "" },
  });
  assert.equal(install.status, 0, `${install.stderr}\n${install.stdout}`);
  return join(dest, "gitleaks");
}

test("seeded fake key fails and a clean tree passes", { timeout: 120_000 }, () => {
  const binary = gitleaksBinary();
  const token = fakeGithubPat();
  assert.match(token, /^ghp_[0-9A-Za-z]{36}$/);
  const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.equal(source.includes(token), false);

  const seeded = outsideRepo("tessera-gitleaks-seeded-");
  const clean = outsideRepo("tessera-gitleaks-clean-");
  try {
    writeFileSync(join(seeded, "leak.txt"), `${token}\n`);
    writeFileSync(join(clean, "readme.txt"), "clean fixture\n");

    const seededResult = runGitleaks({ binary, source: seeded, config, noGit: true });
    const seededText = `${seededResult.lines.join("\n")}\n${seededResult.stderr}`;
    assert.notEqual(seededResult.status, 0, seededText);
    assert.match(seededText, /leak\.txt:1 github-pat/);
    assert.equal(seededText.includes(token), false);
    console.log(`gitleaks-fixture seeded: caught github-pat leak.txt:1 (scanner exit ${seededResult.status})`);

    const cleanResult = runGitleaks({ binary, source: clean, config, noGit: true });
    assert.equal(cleanResult.status, 0, `${cleanResult.lines.join("\n")}\n${cleanResult.stderr}`);
    assert.deepEqual(cleanResult.lines, []);
    console.log("gitleaks-fixture clean: pass (scanner exit 0)");
  } finally {
    rmSync(seeded, { recursive: true, force: true });
    rmSync(clean, { recursive: true, force: true });
  }
});

