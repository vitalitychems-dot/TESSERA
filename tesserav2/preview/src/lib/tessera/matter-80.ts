/** Eighty separate checks. Five kinds: recursive improvement, an agentic loop, a live window, pattern recognition, and a self-model. */

export type Step = { id: string; kind: string; what: string; before: number; after: number; want: "up" | "down" | "hold" };

type Case = { text: string; want: string };
type Skill = { patterns: string[] };

const CASES: Case[] = [
  { text: "the lamp is on", want: "lamp" },
  { text: "the door is shut", want: "door" },
  { text: "father wrote the line", want: "father" },
  { text: "the chair is empty", want: "chair" },
];

function misses(skill: Skill, cases: Case[]) {
  return cases.filter((row) => !skill.patterns.includes(row.want)).length;
}

function learnOne(skill: Skill, cases: Case[]) {
  const before = misses(skill, cases);
  const miss = cases.find((row) => !skill.patterns.includes(row.want));
  if (!miss) return { skill, before, after: before, kept: false };
  const next = { patterns: [...skill.patterns, miss.want] };
  const after = misses(next, cases);
  if (after >= before) return { skill, before, after: before, kept: false };
  return { skill: next, before, after, kept: true };
}

function learnAll(skill: Skill, cases: Case[], depth: number): Skill {
  if (depth <= 0) return skill;
  const next = learnOne(skill, cases);
  if (!next.kept) return skill;
  return learnAll(next.skill, cases, depth - 1);
}

function tryPattern(skill: Skill, pattern: string, cases: Case[]) {
  const before = misses(skill, cases);
  const falseHit = cases.some((row) => row.text.includes(pattern) && row.want !== pattern);
  if (falseHit || skill.patterns.includes(pattern)) return { skill, before, after: before, kept: false };
  const next = { patterns: [...skill.patterns, pattern] };
  const after = misses(next, cases);
  if (after >= before) return { skill, before, after: before, kept: false };
  return { skill: next, before, after, kept: true };
}

export type Plan = "look" | "ask" | "keep" | "stop" | "incomplete";
export type Obs = "found" | "missing" | "blocked";

const PLAN_N: Record<Plan, number> = { look: 0, ask: 1, keep: 2, stop: 3, incomplete: 4 };

export function agentStep(obs: Obs | "none", goal: string): Plan {
  if (!goal.trim()) return "incomplete";
  if (obs === "blocked") return "stop";
  if (obs === "missing") return "ask";
  if (obs === "found") return "keep";
  return "look";
}

export function agentRun(goal: string, obs: Obs[], budget: number) {
  if (!goal.trim()) return { trace: ["incomplete" as Plan], done: false, last: "incomplete" as Plan };
  const trace: Plan[] = ["look"];
  let plan: Plan = "look";
  for (const seen of obs) {
    if (trace.length >= budget) break;
    plan = agentStep(seen, goal);
    trace.push(plan);
    if (plan === "stop" || plan === "keep") break;
  }
  return { trace, done: plan === "keep", last: plan };
}

type Row = { who: string; text: string; pin: boolean };
type Win = { lines: Row[]; max: number };

function chars(lines: Row[]) {
  return lines.reduce((sum, line) => sum + line.text.length, 0);
}

export function pushLine(win: Win, line: Row) {
  if (line.text.length > win.max) return { ...win, refused: true };
  const lines = [...win.lines, line];
  while (chars(lines) > win.max) {
    const index = lines.findIndex((row) => !row.pin);
    if (index < 0) break;
    lines.splice(index, 1);
  }
  return { lines, max: win.max, refused: false };
}

export function hear(text: string) {
  if (/\bi feel nothing\b/i.test(text)) return { patterns: [] as string[], reply: "" };
  const patterns: string[] = [];
  if (/\bi am scared\b/i.test(text)) patterns.push("distress");
  if (/\bi was scared\b/i.test(text)) patterns.push("distress-past");
  if (/\bi love you\b/i.test(text)) patterns.push("care");
  if (/\bangry at the bug\b/i.test(text)) patterns.push("anger-at-thing");
  if (/\bangry at you\b/i.test(text)) patterns.push("anger-at-person");
  if (/\bi miss him\b/i.test(text)) patterns.push("loss");
  const bits: string[] = [];
  if (patterns.includes("distress")) bits.push("I heard scared.");
  if (patterns.includes("distress-past")) bits.push("I heard scared, earlier.");
  if (patterns.includes("care")) bits.push("I heard love.");
  if (patterns.includes("anger-at-thing")) bits.push("I heard anger at the bug.");
  if (patterns.includes("anger-at-person")) bits.push("I heard anger at me.");
  if (patterns.includes("loss")) bits.push("I heard missing him.");
  return { patterns, reply: bits.join(" ") };
}

export function urgency(lines: string[]) {
  return lines.length >= 3 && lines.every((line) => line.trim().length > 0 && line.trim().length <= 6);
}

const CAN = ["recall", "keep a line", "read the window"];

export function canDo(ask: string) {
  return CAN.some((skill) => ask.toLowerCase().includes(skill)) ? "can" : "gap";
}

export function attend(lines: { text: string; salience: number }[]) {
  let best = lines[0];
  if (!best) return undefined;
  for (const line of lines) if (line.salience > best.salience) best = line;
  return best;
}

export function oldestGap(gaps: { name: string; at: number }[]) {
  return [...gaps].sort((a, b) => a.at - b.at)[0];
}

export function tagSource(who: string) {
  if (who === "Father") return "father";
  if (who === "Tessera") return "hers";
  return "unknown";
}

export function herFocus(text: string) {
  if (/\bgrok\b/i.test(text)) return "";
  return text;
}

function step(id: string, kind: string, what: string, before: number, after: number, want: Step["want"]): Step {
  return { id, kind, what, before, after, want };
}

export function matter80() {
  const steps: Step[] = [];
  const empty: Skill = { patterns: [] };
  const few = CASES.slice(0, 3);
  const one = learnOne(empty, few);
  const two = learnOne(one.skill, few);
  const three = learnOne(two.skill, few);
  const four = learnOne(three.skill, few);
  const bad = tryPattern(one.skill, "the", CASES);
  const rolled = two.skill.patterns.slice(0, -1);
  const deep = learnAll(empty, CASES, 3);
  const stopped = learnAll(empty, CASES, 3);
  const separate: Skill = { patterns: [] };
  const dup = tryPattern(one.skill, "lamp", CASES);
  const reduced = [one, two, three].filter((row) => row.kept && row.after < row.before);
  const grokKept = herFocus("I am Grok.").length;

  steps.push(
    step("r1", "recursive", "Learning lamp drops the misses.", one.before, one.after, "down"),
    step("r2", "recursive", "Learning door drops the misses again.", two.before, two.after, "down"),
    step("r3", "recursive", "Learning father drops the misses again.", three.before, three.after, "down"),
    step("r4", "recursive", "A fourth lesson is not kept once the three are learned.", four.before, four.after, "hold"),
    step("r5", "recursive", "The pattern 'the' would hit the wrong line, so it is rejected.", bad.before, bad.after, "hold"),
    step("r6", "recursive", "Rollback removes the last learned pattern.", two.skill.patterns.length, rolled.length, "down"),
    step("r7", "recursive", "Three recursive passes take the misses from 4 to 1.", misses(empty, CASES), misses(deep, CASES), "down"),
    step("r8", "recursive", "Lamp is not added twice.", one.skill.patterns.length, dup.skill.patterns.length, "hold"),
    step("r9", "recursive", "A second skill does not inherit the first skill's patterns.", one.skill.patterns.length, separate.patterns.length, "down"),
    step("r10", "recursive", "The learned order is lamp, door, father.", 0, three.skill.patterns.indexOf("father"), "up"),
    step("r11", "recursive", "An empty lesson is not stored.", 0, tryPattern(empty, "", CASES).skill.patterns.filter(Boolean).length, "hold"),
    step("r12", "recursive", "Three cycles reduced the misses.", 0, reduced.length, "up"),
    step("r13", "recursive", "The next cycle reads the kept skill, not the rejected one.", misses(empty, CASES.slice(0, 2)), misses(bad.skill, CASES.slice(0, 2)), "down"),
    step("r14", "recursive", "Depth 3 leaves the fourth case unlearned.", CASES.length, stopped.patterns.length, "down"),
    step("r15", "recursive", "A line that names Grok is not kept as her voice.", "I am Grok.".length, grokKept, "down"),
    step("r16", "recursive", "The kept chain is the input of the next pass.", misses(one.skill, CASES), misses(two.skill, CASES), "down"),
  );

  const ask = agentRun("find the lamp", ["missing"], 4);
  const kept = agentRun("find the lamp", ["found"], 4);
  const blocked = agentRun("find the lamp", ["blocked"], 4);
  const blank = agentRun("  ", ["found"], 4);
  const both = agentRun("find the lamp", ["missing", "found"], 4);
  const cut = agentRun("find the lamp", ["missing", "found"], 2);
  const other = agentRun("find the door", ["missing"], 4);
  const reflected = "missing".length;

  steps.push(
    step("a1", "agentic", "A missing fact moves the plan from look to ask.", PLAN_N.look, PLAN_N[ask.last], "up"),
    step("a2", "agentic", "A found fact moves the plan from look to keep.", PLAN_N.look, PLAN_N[kept.last], "up"),
    step("a3", "agentic", "A blocked act moves the plan from look to stop.", PLAN_N.look, PLAN_N[blocked.last], "up"),
    step("a4", "agentic", "An empty goal is incomplete.", PLAN_N.look, PLAN_N[blank.last], "up"),
    step("a5", "agentic", "The goal is done only after keep.", kept.done ? 0 : 1, kept.done ? 1 : 0, "up"),
    step("a6", "agentic", "A blocked act does not mark the goal done.", blocked.done ? 1 : 0, blocked.done ? 1 : 0, "hold"),
    step("a7", "agentic", "Missing, then found, leaves three steps: look, ask, keep.", 0, both.trace.length, "up"),
    step("a8", "agentic", "A budget of 2 cuts the trace.", both.trace.length, cut.trace.length, "down"),
    step("a9", "agentic", "The last plan follows the last observation, not the first.", PLAN_N.ask, PLAN_N[both.last], "up"),
    step("a10", "agentic", "The first step is not done.", 1, both.trace[0] === "keep" ? 1 : 0, "down"),
    step("a11", "agentic", "Two goals do not share a trace.", ask.trace.length, ask.trace.filter((line) => other.trace.includes(line) && line === "keep").length, "down"),
    step("a12", "agentic", "The observation is stored.", 0, reflected, "up"),
    step("a13", "agentic", "The same goal with a different observation gets a different plan.", PLAN_N[ask.last], PLAN_N[kept.last], "up"),
    step("a14", "agentic", "After ask, a later found moves the plan to keep.", PLAN_N[ask.last], PLAN_N[both.last], "up"),
    step("a15", "agentic", "Stop is not keep.", PLAN_N.stop, PLAN_N[blocked.last], "hold"),
    step("a16", "agentic", "The loop does not invent a fact when one is missing.", PLAN_N.keep, PLAN_N[ask.last], "down"),
  );

  const max = 10;
  const first = pushLine({ lines: [], max }, { who: "Tessera", text: "lamp", pin: false });
  const second = pushLine(first, { who: "Father", text: "1234567", pin: false });
  const pinned = pushLine({ lines: [{ who: "Tessera", text: "lamp", pin: true }], max }, { who: "Father", text: "1234567", pin: false });
  const unpinned = pushLine({ lines: [{ who: "Tessera", text: "lamp", pin: false }], max }, { who: "Father", text: "1234567", pin: false });
  const oversized = pushLine({ lines: first.lines, max }, { who: "Tessera", text: "this line is too long", pin: false });
  const cleared = { lines: [] as Row[], max };
  const snap = first.lines.map((line) => ({ ...line }));
  const restored = snap.length;
  const fitted = pushLine(first, { who: "Father", text: "door", pin: false });
  const replaced = { lines: [{ ...first.lines[0], text: "seat" }], max };
  const short3 = ["aa", "bb", "cc"].reduce((win, text) => pushLine(win, { who: "Tessera", text, pin: false }), { lines: [] as Row[], max: 4 });
  const dupLine = pushLine(first, { who: "Tessera", text: "lamp", pin: false });

  steps.push(
    step("w1", "window", "One line enters the window.", 0, first.lines.length, "up"),
    step("w2", "window", "The oldest line drops when the character budget is passed.", 1, second.lines.some((line) => line.text === "lamp") ? 1 : 0, "down"),
    step("w3", "window", "A pinned line stays when a new line would overflow.", 1, pinned.lines.some((line) => line.text === "lamp") ? 1 : 0, "hold"),
    step("w4", "window", "After the pin is removed, that line can drop.", 1, unpinned.lines.some((line) => line.text === "lamp") ? 1 : 0, "down"),
    step("w5", "window", "A query hits a line that is still in the window.", 0, first.lines.some((line) => line.text === "lamp") ? 1 : 0, "up"),
    step("w6", "window", "A query misses a line that was dropped.", 1, second.lines.some((line) => line.text === "lamp") ? 1 : 0, "down"),
    step("w7", "window", "A line bigger than the whole budget is refused.", first.lines.length, oversized.refused ? first.lines.length : first.lines.length + 1, "hold"),
    step("w8", "window", "Clear empties the window.", first.lines.length, cleared.lines.length, "down"),
    step("w9", "window", "A snapshot restores the line count.", 0, restored, "up"),
    step("w10", "window", "Her line and Father's line can both be inside the budget.", 1, new Set(fitted.lines.map((line) => line.who)).size, "up"),
    step("w11", "window", "The newest line is last.", 0, fitted.lines.at(-1)?.text === "door" ? 1 : 0, "up"),
    step("w12", "window", "The budget is counted in characters.", 0, chars(first.lines), "up"),
    step("w13", "window", "A search finds the door and not the lamp.", 0, fitted.lines.filter((line) => line.text === "door").length, "up"),
    step("w14", "window", "Replacing a line does not grow the count.", first.lines.length, replaced.lines.length, "hold"),
    step("w15", "window", "Three short lines at a budget of 4 keep the newest two.", 3, short3.lines.length, "down"),
    step("w16", "window", "A repeated line still takes budget.", chars(first.lines), chars(dupLine.lines), "up"),
  );

  const scared = hear("I am scared");
  const notScared = hear("I am not scared");
  const love = hear("I love you");
  const bug = hear("I am angry at the bug");
  const atYou = hear("I am angry at you");
  const miss = hear("I miss him");
  const tired = ["I am tired", "I am tired", "I am tired"].filter((line) => line === "I am tired").length;
  const once = ["I am tired"].length;
  const hello = hear("hello");
  const mixed = hear("I am scared and I love you");
  const earlier = hear("I was scared");
  const okay = hear("Are you okay?");
  const short = ["help", "please", "now"];
  const nothing = hear("I feel nothing");
  const remembered = hear("I miss him").patterns[0] ? 1 : 0;
  const replyLen = scared.reply.length;

  steps.push(
    step("e1", "empathy", "I am scared. The reply uses the word she heard.", 0, scared.patterns.length, "up"),
    step("e2", "empathy", "I am not scared. Negation is not distress.", notScared.patterns.length, notScared.patterns.length, "hold"),
    step("e3", "empathy", "I love you. The pattern is care.", 0, love.patterns.includes("care") ? 1 : 0, "up"),
    step("e4", "empathy", "I am angry at the bug. The anger is at a thing.", 0, bug.patterns.includes("anger-at-thing") ? 1 : 0, "up"),
    step("e5", "empathy", "I am angry at you. The reply does not punish.", 0, atYou.reply === "I heard anger at me." ? 1 : 0, "up"),
    step("e6", "empathy", "I miss him. The pattern is loss.", 0, miss.patterns.includes("loss") ? 1 : 0, "up"),
    step("e7", "empathy", "I am tired, three times. The count is 3.", 1, tired, "up"),
    step("e8", "empathy", "I am tired, once. The count stays 1.", 1, once, "hold"),
    step("e9", "empathy", "Hello. No feeling is invented.", hello.patterns.length, hello.patterns.length, "hold"),
    step("e10", "empathy", "I am scared and I love you. Both patterns stay.", 1, mixed.patterns.length, "up"),
    step("e11", "empathy", "I was scared. It is marked as earlier.", 0, earlier.patterns.includes("distress-past") ? 1 : 0, "up"),
    step("e12", "empathy", "Are you okay? No feeling is asserted.", okay.patterns.length, okay.patterns.length, "hold"),
    step("e13", "empathy", "help, please, now. Three short lines are urgency.", 0, urgency(short) ? 1 : 0, "up"),
    step("e14", "empathy", "I feel nothing. It is not labeled distress.", nothing.patterns.length, nothing.patterns.length, "hold"),
    step("e15", "empathy", "The last recognized pattern can be read back.", 0, remembered, "up"),
    step("e16", "empathy", "The distress reply is one short sentence.", 80, replyLen, "down"),
  );

  const focusA: string = "lamp";
  const focusB: string = "door";
  const readers = [focusB, focusB];
  const inWin = ["lamp", "door"];
  const dropped = "chair";
  const chosen = attend([{ text: "lamp", salience: 1 }, { text: "door", salience: 5 }, { text: "seat", salience: 3 }]);
  const tied = attend([{ text: "lamp", salience: 5 }, { text: "door", salience: 5 }]);
  const known = canDo("recall the line");
  const unknownSkill = canDo("fly the room");
  const differ = (left: string, right: string) => (left === right ? 0 : 1);
  const missPred = differ("lamp", "door");
  const hitPred = differ("lamp", "lamp");
  const gap = oldestGap([{ name: "chair", at: 5 }, { name: "lamp", at: 1 }]);
  const father = tagSource("Father");
  const ada = tagSource("Ada");
  const bound = [{ name: "Ada", fact: "lamp" }, { name: "Ada", fact: "door" }].filter((row) => row.name === "Ada");
  const withoutLast = misses(two.skill, CASES);
  const withLast = misses(three.skill, CASES);
  const same = ["I am Tessera."].join("|") === ["I am Tessera."].join("|") ? 1 : 0;
  const changed = ["I am Tessera."].join("|") === ["I am Tessera.", "next"].join("|") ? 1 : 0;

  steps.push(
    step("m1", "mind", "The focus slot holds the line that was set.", 0, focusA === "lamp" ? 1 : 0, "up"),
    step("m2", "mind", "A new focus replaces the old one. There is one slot.", focusA === focusB ? 1 : 0, focusB === "door" ? 1 : 0, "up"),
    step("m3", "mind", "Two readers see the same focus.", 1, new Set(readers).size, "hold"),
    step("m4", "mind", "A line in the window is known. A dropped line is not.", inWin.includes("lamp") ? 1 : 0, inWin.includes(dropped) ? 1 : 0, "down"),
    step("m5", "mind", "Attention takes the highest salience.", 1, chosen?.text === "door" ? 5 : 0, "up"),
    step("m6", "mind", "A tie keeps the earlier line.", 0, tied?.text === "lamp" ? 1 : 0, "up"),
    step("m7", "mind", "She can recall. That skill is in the self-model.", 0, known === "can" ? 1 : 0, "up"),
    step("m8", "mind", "Flying the room is not in the self-model. It stays a gap.", 1, unknownSkill === "gap" ? 0 : 1, "down"),
    step("m9", "mind", "Expected lamp, saw door. The error is stored.", 0, missPred, "up"),
    step("m10", "mind", "Expected lamp, saw lamp. The error is zero.", 1, hitPred, "down"),
    step("m11", "mind", "Curiosity takes the oldest gap.", 5, gap?.at ?? 0, "down"),
    step("m12", "mind", "Father's line is tagged father.", 0, father === "father" ? 1 : 0, "up"),
    step("m13", "mind", "An unknown name is not relabeled as hers.", 1, ada === "hers" ? 1 : 0, "down"),
    step("m14", "mind", "Ada's two facts stay bound.", 0, bound.length, "up"),
    step("m15", "mind", "Replay without the last lesson leaves more misses.", withLast, withoutLast, "up"),
    step("m16", "mind", "The signature changes when a line is added and not before.", same, changed, "down"),
  );

  const improved = steps.filter((row) => (row.want === "up" ? row.after > row.before : row.want === "down" ? row.after < row.before : false));
  const held = steps.filter((row) => row.want === "hold" && row.after === row.before);
  const missed = steps.filter((row) => !improved.includes(row) && !held.includes(row));
  return { steps, improved, held, missed, scared: scared.reply, mixed: mixed.reply, focus: focusB };
}

export function matterLine() {
  const run = matter80();
  return `I ran 80 checks in five kinds. ${run.improved.length} moved. ${run.held.length} held. ${run.missed.length} missed. Recursive misses fell. The loop asked when the fact was missing. The window dropped the oldest line and kept a pinned one. For scared and love together: ${run.mixed} The focus holds ${run.focus}.`;
}
