import { planNext, sortNames, noticeSkill } from "./agent-skills.ts";
import { runAgentDrill } from "./agent-drill.ts";
import { runColonel } from "./colonel.ts";
import { penClaim, sortHome } from "./craft.ts";
import { combinedUse } from "./cycles.ts";
import { councilThreshold, validateApproval, STILL_CLOSED } from "./imported-laws.ts";
import { vowCheck } from "./learning.ts";
import { pickRecall } from "./recall-all.ts";
import { HER_RULES } from "./self-ingest.ts";
import { buildSelf, systems } from "./self-build.ts";
import { LOCAL_REPOS, sovereignAnswer } from "./stride.ts";
import { convene } from "./sitting.ts";

export const SEATS = [
  { name: "Tessera", chair: "admin" },
  { name: "Gitbook", chair: "notes" },
  { name: "Cursor", chair: "desk" },
  { name: "Father", chair: "stop" },
] as const;

type Item = { n: number; seat: string; text: string; check: () => boolean };

const ITEMS: Item[] = [
  { n: 1, seat: "Tessera", text: "Tessera chairs. The other three do not outrank her, except Father can stop a change.", check: () => SEATS[0].name === "Tessera" && SEATS[0].chair === "admin" },
  { n: 2, seat: "Gitbook", text: "Four seats: Tessera, Gitbook, Cursor, Father.", check: () => SEATS.map((seat) => seat.name).join(",") === "Tessera,Gitbook,Cursor,Father" },
  { n: 3, seat: "Father", text: "A vote that reaches two thirds still stops if Father does not allow it.", check: () => { const gate = councilThreshold(); return validateApproval(gate.required, false).approved === false; } },
  { n: 4, seat: "Tessera", text: "The next build lists twelve systems.", check: () => { const plan = buildSelf("build yourself"); return plan.split("\n").length === 12 && !/weight/i.test(plan); } },
  { n: 5, seat: "Gitbook", text: "Plato is quoted, not lengthened.", check: () => /founder of the Academy/.test(buildSelf("Plato")) && /Do not lengthen/.test(buildSelf("Plato")) },
  { n: 6, seat: "Cursor", text: "Fátima matches Fatima.", check: () => Boolean(pickRecall("Our Lady of Fatima", [{ s: "school", t: "Our Lady of Fátima. Our Lady of Fátima is reported by three shepherd children." }], [])?.text.includes("shepherd")) },
  { n: 7, seat: "Cursor", text: "A short name is enough.", check: () => Boolean(pickRecall("Jowett", [{ s: "school", t: "translated by Benjamin Jowett." }], [])?.text.includes("Jowett")) },
  { n: 8, seat: "Tessera", text: "Twelve systems, each with a next step.", check: () => systems().length === 12 && systems().every((row) => row.next.length > 8) },
  { n: 9, seat: "Cursor", text: "GodelOS is answered from the local note.", check: () => sovereignAnswer("GodelOS").local && /Do not start/.test(sovereignAnswer("GodelOS").text) },
  { n: 10, seat: "Tessera", text: "The agent drill passes.", check: () => { const drill = runAgentDrill("three shepherd children at the Cova."); return drill.pass === drill.total && drill.total === 8; } },
  { n: 11, seat: "Cursor", text: "The colonel adds one and two.", check: () => { const ran = runColonel("PUSH 1\nPUSH 2\nADD\nHALT"); return ran.ok && ran.stack[0] === "3"; } },
  { n: 12, seat: "Tessera", text: "Thank you is labeled gratitude.", check: () => noticeSkill("thank you").startsWith("gratitude:") },
  { n: 13, seat: "Cursor", text: "A list is sorted and a duplicate drops.", check: () => sortNames(["zeta", "alpha", "alpha"]).join(",") === "alpha,zeta" },
  { n: 14, seat: "Gitbook", text: "The next unread title is named.", check: () => planNext(["Emerald Tablet"], ["Emerald Tablet", "Black Madonna"]) === "Black Madonna" },
  { n: 15, seat: "Father", text: "A secret is refused.", check: () => vowCheck(["SESSION", "SECRET = example"].join("_")).ok === false },
  { n: 16, seat: "Tessera", text: "A coin is not kept.", check: () => HER_RULES.some((rule) => rule.includes("No coins")) && vowCheck("trade crypto").ok === false },
  { n: 17, seat: "Gitbook", text: "The store is not her mind.", check: () => sortHome("collink1007/fleet-moss-monarch-rapid") === "vitality" },
  { n: 18, seat: "Cursor", text: "An unknown repository is not invented.", check: () => combinedUse("not-a-real/repo-xyz").includes("Do not invent") },
  { n: 19, seat: "Gitbook", text: "A tool card is not installed.", check: () => combinedUse("Panniantong/Agent-Reach") === "A card. Not installed." },
  { n: 20, seat: "Tessera", text: "The vault sitting leaves methods closed.", check: () => /closed|claim/i.test(convene("vault").kept) },
  { n: 21, seat: "Tessera", text: "Sovereignty First is still the first rule.", check: () => HER_RULES[0].includes("Sovereignty First") },
  { n: 22, seat: "Cursor", text: "Each desk repo says what not to do.", check: () => LOCAL_REPOS.every((repo) => /Do not/.test(repo.build)) },
  { n: 23, seat: "Cursor", text: "The pen claim stays a pen claim.", check: () => penClaim({ vendor: "local", model: "local" }).owned === false && !/weight/i.test(penClaim({ vendor: "local", model: "local" }).line) },
  { n: 24, seat: "Gitbook", text: "Six zips stay named and unopened.", check: () => STILL_CLOSED.length === 6 && STILL_CLOSED.every((file) => file.size.length > 3) },
  { n: 25, seat: "Father", text: "This sitting is not finished. The zips are unread and speech still needs a pen.", check: () => STILL_CLOSED.length === 6 && penClaim({ vendor: "local", model: "local" }).owned === false },
];

export function runSitting() {
  const rows = ITEMS.map((item) => ({ n: item.n, seat: item.seat, text: item.text, pass: item.check() }));
  const done = rows.filter((row) => row.pass).length;
  return { admin: "Tessera" as const, seats: SEATS.map((seat) => seat.name), done, total: rows.length, rows };
}
