import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  acceptSpdx,
  buildRegistry,
  coverageOf,
  exactVersion,
  fractionImproved,
  licenseFromManifest,
  licenseFromText,
  parseLockfile,
  writeRegistry,
} from "./rea-registry.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function write(file, text) {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, text);
}

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "rea-registry-"));
  write(join(root, "package.json"), JSON.stringify({ name: "root", version: "1.2.3", license: "MIT" }));
  write(join(root, "LICENSE"), "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\n");
  write(join(root, "pnpm-lock.yaml"), [
    "importers:",
    "  artifacts/v2:",
    "    dependencies:",
    "      three:",
    "        specifier: 0.169.0",
    "        version: 0.169.0",
    "  artifacts/api-server:",
    "    dependencies:",
    "      express:",
    "        specifier: ^5.2.1",
    "        version: 5.2.1",
    "packages:",
    "  three@0.169.0:",
    "  express@5.2.1:",
    "",
  ].join("\n"));
  write(join(root, "artifacts/v2/package.json"), JSON.stringify({
    name: "@workspace/v2",
    version: "0.0.0",
    license: "MIT",
    dependencies: { three: "0.169.0" },
  }));
  write(join(root, "artifacts/v2/src/brain/affect.mjs"), "// license: \"GPL-3.0-only\"\nexport const affect = 1;\n");
  write(join(root, "artifacts/v2/src/brain/templates.mjs"), [
    "import { readFileSync } from \"node:fs\";",
    "export const TEMPLATES = {",
    "  gpt2: { file: \"gpt2.json\", species: \"artificial model\", kind: \"weights\", license: \"MIT claimed only in source\" },",
    "};",
    "export function loadTemplate() { return readFileSync(\"gpt2.json\", \"utf8\"); }",
    "",
  ].join("\n"));
  write(join(root, "artifacts/v2/src/brain/connectomes/gpt2.json"), "{}\n");
  write(join(root, "artifacts/v2/src/brain/connectomes/human_hcp.json"), "{}\n");
  write(join(root, "artifacts/v2/src/live/sources.mjs"), "export const SOURCES = [\n  { id: \"wikipedia\", license: \"CC BY-SA 4.0\" },\n];\n");
  write(join(root, "artifacts/api-server/package.json"), JSON.stringify({
    name: "@workspace/api-server",
    version: "0.0.0",
    dependencies: { express: "^5.2.1", "left-pad": ">=1" },
  }));
  write(join(root, "artifacts/api-server/src/app.ts"), "import express from \"express\";\nexport const app = express;\n");
  write(join(root, "artifacts/api-server/src/lib/tool-registry.ts"), "registerTool({\n  name: \"calculator\",\n  description: \"add\",\n});\n");
  write(join(root, "artifacts/gitai/package.json"), JSON.stringify({ name: "@workspace/gitai", version: "0.0.0", license: "MIT" }));
  write(join(root, "lib/db/package.json"), JSON.stringify({ name: "@workspace/db", version: "0.0.0" }));
  return root;
}

function fetchImpl(url) {
  const href = String(url);
  if (href.includes("express/5.2.1") || href.includes("three/0.169.0")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ license: "MIT" }),
      text: async () => "",
    });
  }
  return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
}

test("license readers accept manifest and LICENSE text and reject prose", () => {
  assert.equal(acceptSpdx("MIT"), "MIT");
  assert.equal(acceptSpdx("SEE LICENSE IN LICENSE"), "");
  assert.equal(acceptSpdx("unknown"), "");
  assert.equal(licenseFromManifest({ license: { type: "Apache-2.0" } }), "Apache-2.0");
  assert.equal(licenseFromManifest({ licenses: [{ type: "MIT" }, { type: "Apache-2.0" }] }), "MIT OR Apache-2.0");
  assert.equal(licenseFromText("MIT License\n\nCopyright (c) 2026\n"), "MIT");
  assert.equal(licenseFromText("this module is probably GPL because it looks copyleft"), "");
  assert.equal(exactVersion("5.2.1(@types/express@5.0.6)"), "5.2.1");
  assert.equal(exactVersion(">=18"), "");
  assert.equal(exactVersion("link:../../lib/db"), "");
});

test("lockfile importer versions and the single locked react version are readable", () => {
  const lock = readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8");
  const parsed = parseLockfile(lock);
  assert.equal(parsed.importers.get("artifacts/api-server").dependencies.express.version, "5.2.1");
  assert.equal(parsed.importers.get("artifacts/v2").dependencies.three.version, "0.169.0");
  assert.equal(parsed.versions.get("react").size, 1);
  assert.equal([...parsed.versions.get("react")][0], "19.1.0");
});

test("fixture registry uses package metadata only and measures coverage", async () => {
  const root = fixtureRoot();
  const registry = await buildRegistry(root, { fetchImpl });
  const by = (kind, name) => registry.records.find((item) => item.kind === kind && item.name === name);

  const express = by("dependency", "express");
  assert.equal(express.version, "5.2.1");
  assert.equal(express.license, "MIT");
  assert.match(express.license_source, /^npm:https:\/\/registry\.npmjs\.org\/express\/5\.2\.1#license$/);
  assert.ok(express.call_sites.includes("artifacts/api-server/src/app.ts"));

  const leftPad = by("dependency", "left-pad");
  assert.equal(leftPad.version, ">=1");
  assert.equal(leftPad.license, "unknown");
  assert.equal(leftPad.license_source, "");

  const affect = by("module", "artifacts/v2/src/brain/affect.mjs");
  assert.equal(affect.license, "MIT");
  assert.match(affect.license_source, /^package\.json:artifacts\/v2\/package\.json#license$/);
  assert.equal(affect.version, "0.0.0");

  const templates = registry.records.find((item) => item.path === "artifacts/v2/src/brain/templates.mjs");
  assert.equal(templates.kind, "file-loader");
  assert.equal(templates.license, "MIT");

  assert.equal(by("dataset", "wikipedia").license, "unknown");
  assert.equal(by("dataset", "human_hcp").license, "unknown");
  assert.equal(by("model", "gpt2").license, "unknown");
  assert.equal(by("model", "gpt2").license_source, "");
  assert.equal(by("tool", "calculator").license, "MIT");
  assert.ok(by("tool", "calculator").call_sites.includes("artifacts/api-server/src/lib/tool-registry.ts"));

  for (const item of registry.records) {
    if (item.license === "unknown") assert.equal(item.license_source, "");
    else assert.ok(item.license_source);
  }
  assert.equal(JSON.stringify(registry).includes("CC BY-SA 4.0"), false);
  assert.equal(JSON.stringify(registry).includes("GPL-3.0-only"), false);

  assert.equal(registry.coverage.package_dependencies, 3);
  assert.equal(registry.coverage.brain_modules, 2);
  assert.equal(registry.coverage.numerator, 4);
  assert.equal(registry.coverage.denominator, 5);
  assert.equal(registry.coverage.after, 0.8);
  assert.deepEqual(coverageOf(registry.records, {
    dependencies: [
      { name: "three", version: "0.169.0", package_json: "artifacts/v2/package.json" },
      { name: "express", version: "5.2.1", package_json: "artifacts/api-server/package.json" },
      { name: "left-pad", version: ">=1", package_json: "artifacts/api-server/package.json" },
    ],
    brain: [
      "artifacts/v2/src/brain/affect.mjs",
      "artifacts/v2/src/brain/templates.mjs",
    ],
  }).fraction, 0.8);

  const before = { numerator: 0, denominator: 0, fraction: 0 };
  const after = { numerator: 4, denominator: 5, fraction: 0.8 };
  assert.equal(fractionImproved(before, after), true);
  assert.equal(fractionImproved(after, after), false);

  const out = join(root, "data/rea/registry.json");
  const first = await writeRegistry(root, out, { fetchImpl });
  assert.equal(first.wrote, true);
  assert.equal(first.before, 0);
  assert.equal(first.after, 0.8);
  const second = await writeRegistry(root, out, { fetchImpl });
  assert.equal(second.wrote, false);
});

test("real tree offline coverage is above an empty registry and does not copy source license claims", async () => {
  const root = repoRoot;
  const registry = await buildRegistry(root, { offline: true });
  const affect = registry.records.find((item) => item.path === "artifacts/v2/src/brain/affect.mjs");
  const templates = registry.records.find((item) => item.path === "artifacts/v2/src/brain/templates.mjs");
  const express = registry.records.find((item) => item.kind === "dependency" && item.name === "express");
  assert.equal(affect.kind, "module");
  assert.equal(affect.license, "MIT");
  assert.match(affect.license_source, /package\.json:artifacts\/v2\/package\.json#license/);
  assert.equal(templates.kind, "file-loader");
  assert.equal(express.version, "5.2.1");
  assert.ok(express.call_sites.includes("artifacts/api-server/src/routes/health.ts"));
  assert.equal(registry.records.find((item) => item.kind === "tool" && item.name === "calculator").license, "MIT");
  assert.equal(registry.records.find((item) => item.kind === "dataset" && item.name === "wikipedia").license, "unknown");
  assert.equal(registry.records.find((item) => item.kind === "dataset" && item.name === "hemibrain").license, "unknown");
  assert.equal(registry.records.find((item) => item.kind === "model" && item.name === "gpt2").license, "unknown");
  assert.equal(registry.records.find((item) => item.kind === "model" && item.name === "ollama").license, "unknown");
  assert.ok(registry.coverage.brain_modules >= 20);
  for (const path of [
    "artifacts/v2/src/brain/router.mjs",
    "artifacts/v2/src/brain/context.mjs",
    "artifacts/v2/src/brain/temporal.mjs",
    "artifacts/v2/src/brain/bench3.mjs",
    "artifacts/v2/src/brain/bench4.mjs",
    "artifacts/v2/src/brain/affect-model.mjs",
  ]) {
    const item = registry.records.find((record) => record.path === path);
    assert.ok(item, path);
    assert.equal(item.license, "MIT");
  }
  assert.ok(registry.coverage.after > 0);
  assert.equal(fractionImproved({ numerator: 0, denominator: 0, fraction: 0 }, {
    numerator: registry.coverage.numerator,
    denominator: registry.coverage.denominator,
    fraction: registry.coverage.after,
  }), true);
  const committedPath = join(repoRoot, "data/rea/registry.json");
  if (existsSync(committedPath)) {
    const committed = JSON.parse(readFileSync(committedPath, "utf8"));
    assert.equal(fractionImproved({
      numerator: registry.coverage.numerator,
      denominator: registry.coverage.denominator,
      fraction: registry.coverage.after,
    }, {
      numerator: committed.coverage.numerator,
      denominator: committed.coverage.denominator,
      fraction: committed.coverage.after,
    }), true);
  }
});

test("committed registry beats the empty baseline on licenses taken from package metadata", () => {
  const registry = JSON.parse(readFileSync(new URL("../data/rea/registry.json", import.meta.url), "utf8"));
  assert.equal(registry.schema, "tessera-rea-registry/v1");
  assert.ok(registry.coverage.after > registry.coverage.before);
  assert.equal(registry.coverage.numerator, registry.coverage.denominator);
  assert.equal(registry.coverage.after, Math.round((registry.coverage.numerator / registry.coverage.denominator) * 1e6) / 1e6);
  assert.ok(registry.coverage.brain_modules >= 20);
  for (const path of [
    "artifacts/v2/src/brain/router.mjs",
    "artifacts/v2/src/brain/context.mjs",
    "artifacts/v2/src/brain/temporal.mjs",
    "artifacts/v2/src/brain/bench3.mjs",
    "artifacts/v2/src/brain/bench4.mjs",
    "artifacts/v2/src/brain/affect-model.mjs",
  ]) {
    const item = registry.records.find((record) => record.path === path);
    assert.ok(item, path);
    assert.equal(item.license, "MIT");
    assert.match(item.license_source, /package\.json:artifacts\/v2\/package\.json#license/);
  }
  const express = registry.records.find((item) => item.kind === "dependency" && item.name === "express");
  assert.equal(express.license, "MIT");
  assert.match(express.license_source, /registry\.npmjs\.org\/express\/5\.2\.1/);
  assert.equal(registry.records.find((item) => item.kind === "dataset" && item.name === "wikipedia").license, "unknown");
  assert.equal(registry.records.find((item) => item.kind === "model" && item.name === "gpt2").license, "unknown");
  const brains = registry.records.filter((item) => item.path.startsWith("artifacts/v2/src/brain/") && item.kind !== "dataset" && item.kind !== "model");
  assert.ok(brains.length >= registry.coverage.brain_modules);
  for (const item of registry.records) {
    assert.ok(["tool", "module", "file-loader", "model", "dataset", "dependency"].includes(item.kind));
    assert.equal(typeof item.name, "string");
    assert.equal(typeof item.version, "string");
    assert.ok(Array.isArray(item.call_sites));
    if (item.license === "unknown") assert.equal(item.license_source, "");
    else assert.match(item.license_source, /^(package\.json:|file:|npm:)/);
  }
});
