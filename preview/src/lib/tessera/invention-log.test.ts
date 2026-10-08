import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { pickFed } from "./father-fed.ts";

test("a question returns the fed card in the words that were written", async () => {
  const raw = await readFile("data/school/father-fed.jsonl", "utf8");
  const rows = raw.trim().split("\n").map((line) => JSON.parse(line) as { q: string; a: string });
  const hit = pickFed("Radionic Rate Mathematics", rows);
  assert.match(hit, /Radionic Rate Mathematics/);
  assert.equal(hit.includes("not a device"), false);
});
