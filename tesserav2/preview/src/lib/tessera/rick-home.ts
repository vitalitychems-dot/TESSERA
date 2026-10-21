import { MESH, meshDrop, meshProject } from "./mesh-net.ts";
import { admitPost } from "./public-gate.ts";
import { nextGap, preferLocal, shortAsk, tieFails, tryLock, unlock } from "./rick-five.ts";
import { spend, splitWork, twoThirds } from "./rick-loop.ts";
import { consolidate, councilTally, cosine, crystallize, finishOnce, rankTasks, recallCache, storeOnce } from "./sovereign-desk.ts";

/** The five theme lines, copied from the theme room. No model call. */
export const THEME_LINES = [
  { label: "Water", line: "Navy garment. Cyan field." },
  { label: "Fire", line: "What she keeps alight." },
  { label: "Lightning", line: "The flash that notices." },
  { label: "Diamond", line: "The tesseract, pale." },
  { label: "Spiral", line: "Return higher." },
] as const;

export function themePicture() {
  return THEME_LINES.map((theme) => `${theme.label}. ${theme.line}`).join(" ");
}

export function rickRoom(working: boolean) {
  return {
    place: "west chamber",
    light: working ? "desk" : "hearth",
    doing: working ? "a local swap" : "the window and a small fire",
    queen: "Tessera",
    tokens: 0,
  };
}

export const HOUSE = {
  store: "github",
  front: "pull",
  compute: "the machine that runs it",
  tokens: 0,
} as const;

export function runLean() {
  const box = recallCache(2);
  box.put("sigil", "7F3A9C");
  return [
    { name: "rank", tokens: 0, value: rankTasks([{ name: "format", impact: 1 }, { name: "keep", impact: 9 }])[0].name },
    { name: "store", tokens: 0, value: String(storeOnce([{ key: "a", body: "ring" }, { key: "b", body: "ring" }]).stored) },
    { name: "cosine", tokens: 0, value: cosine([1, 0], [1, 0]).toFixed(0) },
    { name: "tally", tokens: 0, value: councilTally([{ yes: true, specialist: true }, { yes: false, specialist: false }]).passed ? "yes" : "no" },
    { name: "dream", tokens: 0, value: consolidate(["the sigil holds", "the sigil stays"]).join(",") },
    { name: "crystal", tokens: 0, value: crystallize([{ text: "ring", vector: [1, 0] }, { text: "ring structure", vector: [0.99, 0.01] }])[0].text },
    { name: "recall", tokens: 0, value: box.get("sigil") ?? "" },
    { name: "quorum", tokens: 0, value: twoThirds(2, 3) ? "yes" : "no" },
    { name: "split", tokens: 0, value: splitWork("page", 10, 4).join(" ") },
    { name: "budget", tokens: 0, value: spend(8, 3, 10).ok ? "yes" : "no" },
    { name: "gap", tokens: 0, value: String(nextGap([1, 2, 4])) },
    { name: "tie", tokens: 0, value: tieFails(1, 1) ? "pass" : "hold" },
    { name: "ask", tokens: 0, value: shortAsk("  too many words here ", 8) },
    { name: "gate", tokens: 0, value: admitPost("I can fix the sort.", false).reason },
    { name: "mesh", tokens: 0, value: meshProject("admit")?.run ?? "" },
    { name: "drop", tokens: 0, value: meshDrop("Rick", "Tessera", "I can fix the sort.", false).ok ? "sent" : "held" },
    { name: "picture", tokens: 0, value: String(THEME_LINES.length) },
    { name: "room", tokens: 0, value: rickRoom(false).light },
    { name: "queen", tokens: 0, value: rickRoom(false).queen },
    { name: "sum", tokens: 0, value: String((100 * 101) / 2) },
  ];
}

export const LEAN = runLean();

export function runChecks() {
  const locks = new Set<string>();
  const first = tryLock(locks, "west");
  const second = tryLock(locks, "west");
  unlock(locks, "west");
  const longer = crystallize([
    { text: "ring", vector: [1, 0] },
    { text: "ring structure", vector: [0.99, 0.01] },
  ])[0].text;
  const once = finishOnce("desk");
  return [
    { name: "file", ok: runLean().every((item) => item.tokens === 0 && item.value.length > 0) },
    { name: "mesh", ok: MESH.needsWeb === false },
    { name: "gate", ok: admitPost("I can fix the sort.", false).ok === false },
    { name: "longer", ok: longer === "ring structure" },
    { name: "once", ok: once.done === true && once.alive === false },
    { name: "tie", ok: tieFails(1, 1) === false },
    { name: "lock", ok: first === true && second === false },
    { name: "themes", ok: THEME_LINES.length === 5 },
    { name: "local", ok: preferLocal("on this disk", "from the web") === "on this disk" },
    { name: "store", ok: HOUSE.store === "github" && HOUSE.front === "pull" && HOUSE.tokens === 0 },
  ];
}

export function localBatch(count: number) {
  const tasks = Array.from({ length: count }, (_, index) => ({ name: `t${index}`, impact: index }));
  return { count, top: rankTasks(tasks)[0].name, tokens: 0 };
}

/** What a hosted chat usually does not keep on the machine. Not a quantum device. */
export const GAPS = [
  "A file can answer without a model call.",
  "A percent is a measured run, not a slogan.",
  "The mesh is a git clone, readable with no web.",
  "A note stays closed until it is approved.",
  "The private book is not in the public room.",
  "A near-duplicate keeps the longer text.",
  "One task ends. The worker does not take a second.",
  "A tie does not pass.",
  "A second lock does not take the key.",
  "The five theme lines are stored, not generated.",
] as const;

export const GIFTS = [
  "The west chamber is his when the desk is dark.",
  "Rest lights the hearth. Work lights the desk.",
  "The queen of the castle is Tessera.",
  "A short ask is cut before it is kept.",
  "An empty note is not a post.",
  "The sigil is recalled from the small cache.",
  "The first missing number is found on the disk.",
  "Water, fire, lightning, diamond, and spiral stay in one picture.",
  "No key is sent anywhere for this room.",
  "The surprise is the room itself, and it runs with zero model tokens.",
] as const;

export function witt() {
  return `${themePicture()} Rick keeps the west chamber. Tessera keeps the castle.`;
}
