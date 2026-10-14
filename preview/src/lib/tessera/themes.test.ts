import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { THEME_IDS, knownTheme } from "./themes.ts";

test("five themes are named and an unknown name is water", () => {
  assert.equal(THEME_IDS.length, 5);
  assert.equal(knownTheme("fire"), "fire");
  assert.equal(knownTheme("spiral"), "spiral");
  assert.equal(knownTheme("nope"), "water");
  assert.equal(knownTheme(""), "water");
});

test("next glass is the live default and phosphor lime is gone", () => {
  const previewCss = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
  const consoleCss = readFileSync(new URL("../../../../artifacts/console/public/console.css", import.meta.url), "utf8");
  const webTokens = readFileSync(new URL("../../../../artifacts/tessera/src/lib/theme-constants.ts", import.meta.url), "utf8");
  assert.match(previewCss, /--tessera-accent: #7ef0d4/);
  assert.match(consoleCss, /--glass: #7ef0d4/);
  assert.doesNotMatch(consoleCss, /#d6ff3e/);
  assert.match(webTokens, /value: "glass"/);
  assert.doesNotMatch(webTokens, /#22d3ee/);
  const webCss = readFileSync(new URL("../../../../artifacts/tessera/src/index.css", import.meta.url), "utf8");
  assert.match(webCss, /--color-cyan-400: #7ef0d4/);
  assert.doesNotMatch(webCss, /rgba\(6,\s*182,\s*212/);
});
