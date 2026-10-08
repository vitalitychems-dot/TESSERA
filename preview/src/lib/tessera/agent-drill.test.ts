import assert from "node:assert/strict";
import test from "node:test";
import { runAgentDrill } from "./agent-drill.ts";

test("the agent drill only passes skills that answered", () => {
  const result = runAgentDrill("Our Lady of Fátima is based on the Marian apparitions reported by three shepherd children.");
  assert.equal(result.pass, result.total);
  assert.equal(result.total, 8);
});
