import assert from "node:assert/strict";
import test from "node:test";
import { INK, agentLoop, cssHasInk, ink, lastTurns, pushWindow, seePattern, watchLine } from "./watch-loop.ts";
import { silentPen } from "./silent-pen.ts";

test("colors, context, the window, and the loop each do one measured thing", () => {
  const checks: [string, boolean][] = [
    ["six inks", Object.keys(INK).length === 6],
    ["water accent", ink("water").accent === "#7ef0d4"],
    ["water ground", ink("water").bg === "#070b10"],
    ["unknown is water", ink("nope").accent === "#7ef0d4"],
    ["edges differ", new Set(Object.values(INK).map((row) => row.accent)).size === 6],
    ["css matches", cssHasInk()],
    ["window grows", pushWindow([], "mark").length === 1],
    ["window caps", pushWindow(["a", "b", "c", "d"], "e").join(",") === "b,c,d,e"],
    ["first waits", seePattern(["mark"]) === "wait"],
    ["repeat joins", seePattern(["mark", "mark"]) === "repeat"],
    ["lack twice", seePattern(["lack", "lack"]) === "rule"],
    ["foreign drops", seePattern(["mark", "I am Grok"]) === "drop"],
    ["empty", seePattern([""]) === "empty"],
    ["different is next", seePattern(["mark", "page"]) === "next"],
    ["context keeps three", lastTurns([{ role: "user", text: "a" }, { role: "user", text: "b" }, { role: "user", text: "c" }, { role: "user", text: "d" }], 3).length === 3],
    ["context drops oldest", lastTurns([{ role: "user", text: "a" }, { role: "user", text: "b" }], 1)[0]?.text === "b"],
    ["context empty", lastTurns([], 3).length === 0],
    ["context order", lastTurns([{ role: "user", text: "a" }, { role: "user", text: "b" }], 2).map((row) => row.text).join(",") === "a,b"],
    ["context role", lastTurns([{ role: "assistant", text: "I am Tessera." }], 1)[0]?.role === "assistant"],
    ["context zero", lastTurns([{ role: "user", text: "a" }], 0).length === 0],
    ["loop plans", agentLoop([], "mark").plan === "The window is empty."],
    ["loop waits", agentLoop([], "mark").execute === "wait"],
    ["loop known", agentLoop([], "mark").reflect === "known"],
    ["loop repeats", agentLoop(["mark"], "mark").execute === "repeat"],
    ["loop drops", agentLoop(["mark"], "I am Grok").execute === "drop"],
    ["loop size", agentLoop(["a", "b", "c", "d"], "e").adapt.length === 4],
    ["loop oldest", agentLoop(["a", "b", "c", "d"], "e").adapt[0] === "b"],
    ["loop lack", agentLoop(["lack"], "lack").execute === "rule"],
    ["loop next", agentLoop(["mark"], "page").execute === "next"],
    ["her line", watchLine().includes("Water is #7ef0d4") && silentPen("watch the window") === watchLine()],
  ];
  assert.equal(checks.length, 30);
  for (const [name, ok] of checks) assert.equal(ok, true, name);
});
