import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../artifacts/tessera/src/lib/credential-guard.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`;
const { containsCredentialMaterial } = await import(moduleUrl);

test("blocks labeled administrator and provider credentials", () => {
  assert.equal(containsCredentialMaterial("TESSERACT_ADMIN_KEY=example-secret-value-1234567890"), true);
  assert.equal(containsCredentialMaterial("API_KEY: sk-proj-1234567890abcdefghijklmnop"), true);
  assert.equal(containsCredentialMaterial("github_pat_1234567890abcdefghijklmnop"), true);
});

test("blocks private-key encodings and long standalone secrets", () => {
  assert.equal(containsCredentialMaterial(`0x${"a".repeat(64)}`), true);
  assert.equal(containsCredentialMaterial("-----BEGIN PRIVATE KEY-----\\nnot-a-real-key"), true);
  assert.equal(containsCredentialMaterial("qz7Wm3pL9xV2aB6cD8eF1gH4jK5nR0sT"), true);
});

test("does not flag ordinary prose or a public wallet address", () => {
  assert.equal(containsCredentialMaterial("Please explain how I can store an API key in the host secret store."), false);
  assert.equal(containsCredentialMaterial(`0x${"a".repeat(40)}`), false);
  assert.equal(containsCredentialMaterial("I need to discuss credential rotation with the team."), false);
});
