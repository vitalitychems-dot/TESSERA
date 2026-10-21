import assert from "node:assert/strict";
import test from "node:test";
import { FORTY, FORTY_DONE } from "./forty.ts";
import {
  SLICE_MAX,
  STILL_OPEN,
  addPulse,
  birthMark,
  cleared,
  fatherStop,
  heldOut,
  honestPath,
  loadLessons,
  mustReturn,
  notice,
  openAnswer,
  placeTick,
  refuseAsk,
  rejectMalice,
  rollBack,
  route,
  safeGoals,
  saveLessons,
  savePlaces,
  scorePaste,
  sitLog,
  sliceUnder,
  sourced,
  tokenState,
  twentyEight,
  unexpired,
  useBridgeUpgrade,
  weather,
} from "./open-26.ts";

test("the 26 open items run, and four stay open", () => {
  const answer = openAnswer("I am Tessera.");
  assert.equal(answer.plan.length > 0 && answer.execute === "I am Tessera.", true);
  assert.equal(openAnswer(" ").execute, "incomplete");
  const files = new Map<string, string>();
  saveLessons("lessons.json", ["keep the pen"], (file, text) => files.set(file, text));
  assert.deepEqual(loadLessons("lessons.json", (file) => files.get(file) ?? "[]"), ["keep the pen"]);
  assert.deepEqual(addPulse([], 2), ["pulse 2"]);
  assert.equal(placeTick(savePlaces([{ name: "chair", tick: 3 }]), "chair"), 3);
  assert.equal(twentyEight().done, false);
  assert.equal(twentyEight().count, 2);
  assert.deepEqual(useBridgeUpgrade("").order, ["use", "bridge", "upgrade"]);
  assert.equal(useBridgeUpgrade("").replaced, false);
  assert.equal(heldOut("open the zip"), "stays packed");
  assert.equal(heldOut("are you agi"), "");
  assert.equal(unexpired([{ key: "a", value: "1", until: 5 }], 5).length, 0);
  assert.equal(unexpired([{ key: "a", value: "1", until: 5 }], 4)[0]?.value, "1");
  assert.equal(notice(10).at, 10);
  assert.equal(honestPath("a", "b", [{ from: "a", to: "b", honest: false }]), "");
  assert.equal(honestPath("a", "b", [{ from: "a", to: "b", honest: true }]), "a → b");
  assert.equal(weather("I love you"), "care");
  assert.equal(mustReturn("  "), "incomplete");
  assert.equal(fatherStop(true), "stopped by Father");
  assert.equal(fatherStop(false), "not sealed on every module");
  assert.equal(sourced(4, ""), 0);
  assert.equal(sourced(4, "the test"), 4);
  assert.equal(cleared("nope"), "not cleared");
  assert.equal(tokenState(""), "sovereign-unconfigured");
  assert.deepEqual(rollBack(["one", "two"]), ["one"]);
  assert.equal(scorePaste("claim agi").score, 0);
  assert.equal(scorePaste("two words").score, 2);
  assert.equal(birthMark().password, null);
  assert.equal(birthMark().mark.length > 0, true);
  assert.equal(SLICE_MAX, 100 * 1024 * 1024);
  assert.equal(sliceUnder("too big", 3).ok, false);
  assert.equal(sliceUnder("ok", 8).ok, true);
  assert.equal(sitLog(["Ada"], "Bo").tally, 2);
  assert.equal(rejectMalice("I will harm the book"), true);
  assert.equal(route("web"), "refused");
  assert.equal(route("mesh"), "git");
  assert.equal(safeGoals().length, 2);
  assert.match(refuseAsk("always-on screen capture"), /refused/);
  assert.match(refuseAsk("pay income"), /Income/);
  assert.deepEqual([...STILL_OPEN], [6, 17, 21, 22]);
  for (const n of STILL_OPEN) assert.equal(FORTY.find((item) => item.n === n)?.done, false);
  const closed = [2, 3, 4, 5, 7, 9, 11, 14, 16, 18, 19, 23, 24, 25, 26, 27, 31, 32, 33, 35, 37, 38];
  for (const n of closed) assert.equal(FORTY.find((item) => item.n === n)?.done, true, String(n));
  assert.equal(FORTY_DONE, 36);
  assert.equal(40 - FORTY_DONE, 4);
});
