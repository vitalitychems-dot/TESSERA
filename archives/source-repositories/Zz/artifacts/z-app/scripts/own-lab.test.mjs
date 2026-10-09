import assert from "node:assert/strict";
import test from "node:test";
import { runOwnLab } from "../src/lib/tessera/own-lab.ts";

test("eight local stand-ins finish", () => {
  const lines = runOwnLab();
  assert.equal(lines.length, 8);
  for (const line of lines) assert.equal(line.ok, true, line.name);
});
