import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

test("LICENSE is MIT and package.json declares MIT", () => {
  const license = readFileSync(new URL("LICENSE", root), "utf8");
  assert.match(license, /MIT License/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.equal(pkg.license, "MIT");
  const v2 = JSON.parse(readFileSync(new URL("artifacts/v2/package.json", root), "utf8"));
  assert.equal(v2.license, "MIT");
});

test("NOTICE attributes clean-room sources", () => {
  const notice = readFileSync(new URL("NOTICE", root), "utf8");
  assert.match(notice, /agentcraft \(MIT\)/);
  assert.match(notice, /api-anything \(MIT\)/);
  assert.match(notice, /flowsint \(Apache-2\.0\)/);
  assert.match(notice, /server-memory/);
  assert.match(notice, /No third-party source files were copied/);
});
