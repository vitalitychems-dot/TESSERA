import assert from "node:assert/strict";
import test from "node:test";
import { lackAgain } from "./lack-again.ts";

test("a lack returns a rule only the second time, and nothing is created", () => {
  const once = lackAgain([{ name: "no carried page", times: 1 }]);
  assert.deepEqual(once.rules, []);
  const twice = lackAgain([
    { name: "no carried page", times: 2 },
    { name: "missing mark", times: 2 },
    { name: "a new universe", times: 9 },
  ]);
  assert.deepEqual(twice.rules, [
    { name: "no carried page", rule: "Say Not carried. Do not fetch." },
    { name: "missing mark", rule: "Do not join the seat." },
  ]);
  assert.equal(twice.waited, 0);
  assert.equal(twice.assembled, false);
});
