import { test } from "node:test";
import assert from "node:assert/strict";
import { compare } from "./scorecard.mjs";
import { compute, parseGain } from "./recursion_rate.mjs";

test("parseGain reads 'Gain: +N%' and defaults to 0", () => {
  assert.equal(parseGain("x\nGain: +12.5%\n"), 12.5);
  assert.equal(parseGain("**Gain:** -3%"), -3);
  assert.equal(parseGain("no gain line"), 0);
  assert.equal(parseGain(null), 0);
});
test("recursion_rate counts only gated merges in the window", () => {
  const now = "2026-10-13T12:00:00Z";
  const prs = [
    { mergedAt: "2026-10-12T00:00:00Z", body: "Gain: +14%", texts: ["Security PASS abc"] },
    { mergedAt: "2026-10-11T00:00:00Z", body: "", texts: ["Build (TESTED): PASS"] },
    { mergedAt: "2026-10-11T00:00:00Z", body: "Gain: +99%", texts: ["lgtm"] },
    { mergedAt: "2026-10-01T00:00:00Z", body: "Gain: +50%", texts: ["Moderator PASS"] },
  ];
  const r = compute(prs, now);
  assert.equal(r.gated_merged, 2);
  assert.equal(r.mean_gain_pct, 7);
  assert.equal(r.value, 2);
  assert.deepEqual(compute(prs, now), r);
});
test("compare fails only on a drop beyond the noise band", () => {
  const s = (a, b, c) => ({ agi_proxy: { value: a, noise_band: 0.01 }, consciousness_proxy: { value: b, noise_band: 0 }, recursion_rate: { value: c, noise_band: 0 } });
  assert.equal(compare(s(0.5, 0.9, 1), s(0.495, 0.9, 1)).verdict, "PASS");
  assert.equal(compare(s(0.5, 0.9, 1), s(0.48, 0.9, 1)).verdict, "FAIL");
  assert.equal(compare(s(null, 0.9, 1), s(null, 0.9, 1)).rows[0].verdict, "n/a");
  assert.equal(compare(s(0.5, 0.9, 1), s(null, 0.9, 1)).verdict, "FAIL");
});
