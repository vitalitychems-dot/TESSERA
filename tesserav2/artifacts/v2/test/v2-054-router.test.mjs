import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { countTokens } from "../src/token/meter.mjs";
import { LEAD_MODEL, SMALL_MODEL, compressPrompt, compressedTokens, routeModel } from "../src/token/router.mjs";

const whitespaceFold = (text) => String(text).replace(/\s+/g, " ").trim();

function logCompress(fixture, text) {
  const beforeTokens = countTokens(whitespaceFold(text));
  const afterTokens = countTokens(compressPrompt(text));
  const saved = beforeTokens - afterTokens;
  const pct = beforeTokens === 0 ? "0.00" : ((saved / beforeTokens) * 100).toFixed(2);
  console.log(`COMPRESS_PROMPT beforeTokens=${beforeTokens} afterTokens=${afterTokens} saved=${saved} pct=${pct} fixture=${fixture}`);
  return { beforeTokens, afterTokens, saved };
}

test("a classify fixture uses the small sim model and a tighter prompt", () => {
  const choice = routeModel({ kind: "classify", text: "label this note" });
  assert.equal(choice, SMALL_MODEL);
  assert.equal(routeModel({ kind: "plan" }), LEAD_MODEL);
  assert.doesNotMatch(choice, /openai/i);
  assert.doesNotMatch(LEAD_MODEL, /openai/i);

  const padded = "  classify   this    note   ";
  assert.ok(compressedTokens(padded) < countTokens(padded));
  assert.equal(compressPrompt(padded), "classify this note");
});

test("compressPrompt strips markdown link and image URLs", () => {
  const raw = "See [the gate](https://github.com/vitalitychems-dot/TESSERA/pull/205) and ![diagram](https://cdn.example.com/a/b/diagram.png).";
  const out = compressPrompt(raw);
  assert.equal(out, "See the gate and diagram.");
  assert.equal(out.includes("https://"), false);
  assert.ok(countTokens(out) < countTokens(whitespaceFold(raw)));
  assert.equal(compressPrompt("call array[i](arg) stays"), "call array[i](arg) stays");
});

test("compressPrompt drops HTML comments and fence language tags", () => {
  const raw = "Keep <!-- https://example.com/secret/token --> this\n```md\n[keep](https://example.com/in-code)\n```\n";
  const out = compressPrompt(raw);
  assert.equal(out.includes("secret/token"), false);
  assert.equal(out.includes("```md"), false);
  assert.equal(out.includes("[keep](https://example.com/in-code)"), true);
  assert.equal(out.includes("Keep"), true);
  assert.equal(out.includes("this"), true);
});

test("compressPrompt saves tokens on OPTIMIZE-26 markdown links", () => {
  const linked = readFileSync(new URL("../../../docs/v2/OPTIMIZE-26.md", import.meta.url), "utf8");
  const measured = logCompress("docs/v2/OPTIMIZE-26.md", linked);
  assert.ok(measured.afterTokens < measured.beforeTokens);
  assert.ok(measured.saved / measured.beforeTokens >= 0.01);
});
