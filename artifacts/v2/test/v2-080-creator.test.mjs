import test from "node:test"; import assert from "node:assert/strict";
import { profile, score, auc } from "../src/brain/creator/style.mjs";
import { createProfile } from "../src/brain/creator/profile.mjs";
const me = ["yes and make it faster abd cheaper", "read all the repos and improve further", "go through everything and build it", "approve all and continue"];
const bot = ["I merged PR #12 as `abc123`. All 40 tests pass.", "The scoreboard is merged. Reply yes to keep it, or undo.", "Here's the ranked list, speed first, then accuracy."];
test("style score separates a casual writer from markdown prose", () => {
  const M = profile(me), B = profile(bot);
  const pos = ["make it read everything and go faster"].map((s) => score(M, B, s));
  const neg = ["I merged #13. Tests pass (12/12)."].map((s) => score(M, B, s));
  assert.equal(auc(pos, neg), 1);
});
test("profile keeps source refs, resolves by recency, logs changes", () => {
  const P = createProfile();
  P.ingest({ id: "a", t: 1, text: "Token efficiency comes before anything" });
  const ch = P.ingest({ id: "b", t: 2, text: "Accuracy first, before speed" });
  const it = P.items.get("rule:priority");
  assert.equal(it.ref, "b"); assert.equal(it.supersedes, "a"); assert.ok(ch.includes("rule:priority"));
  assert.equal(P.timeline.at(1).nodes.get("rule:priority").ref, "a");
  assert.ok(!JSON.stringify(P.snapshot()).includes("Accuracy"));
});
