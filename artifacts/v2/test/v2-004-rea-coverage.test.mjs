import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("REA coverage table lists each staged tree and its percent", () => {
  const text = readFileSync(new URL("../../../docs/v2/REA-COVERAGE.md", import.meta.url), "utf8");
  const expected = [
    ["GitMesh", "9", "7", "77.8%"],
    ["Gitbook-full", "1186", "1006", "84.8%"],
    ["TESSERA", "1431", "1367", "95.5%"],
    ["Zz", "137", "115", "83.9%"],
    ["amber", "178", "147", "82.6%"],
    ["vitality", "716", "692", "96.6%"],
  ];
  const rows = [...text.matchAll(/^\| ([^|]+) \| (\d+) \| (\d+) \| (\d+\.\d%) \|$/gm)];
  assert.equal(rows.length, expected.length);
  for (let i = 0; i < expected.length; i += 1) {
    assert.deepEqual(rows[i].slice(1), expected[i]);
    const parsed = Number(expected[i][2]);
    const relevant = Number(expected[i][1]);
    const pct = (parsed / relevant) * 100;
    assert.ok(Math.abs(pct - Number(expected[i][3].replace("%", ""))) < 0.05);
  }
  assert.match(text, /1T/);
  assert.match(text, /not combined into Tessera/);
});
