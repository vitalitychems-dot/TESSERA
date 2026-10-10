import { roomsAt } from "./house-sim.ts";
import { inventionAnswer } from "./invention-log.ts";
import { loveFromFiles } from "./love-local.ts";
import { ownFromQuestion } from "./own-versions.ts";
import { issuePass } from "./pass.ts";
import { useEngines } from "./secret-engines.ts";
import { directSkill } from "./skill-use.ts";
import { mayRun, tesseraVote, workshopRun } from "./workshop.ts";

const PROGRAMS = ["admit", "carry", "spin", "tie"] as const;

/** One question reaches the engines, the vote, the house, the door, and the mesh. */

export function askAll(question: string) {
  const q = question.trim();
  if (!q) return null;
  if (/^open\s+(TESSERA|Gitbook|GitbookAI|vitality)\b/i.test(q)) return null;
  const engine = useEngines(q);
  if (engine) return engine;
  const lower = q.toLowerCase();
  if (/^\s*(vote|approve)\b/i.test(q)) {
    const vote = tesseraVote(q);
    const run = mayRun(q);
    return `${vote.vote}. ${vote.reason} Father ${run.father.vote}. Runs ${run.ok ? "yes" : "no"}.`;
  }
  const program = PROGRAMS.find((name) => new RegExp(`\\b${name}\\b`, "i").test(q));
  if (program && /\b(run|start)\b/i.test(q)) return workshopRun(program, true, 0).reason;
  const guest = q.match(/^welcome\s+(.+?)\s+for\s+(.+)$/i);
  if (guest?.[1] && guest[2]) {
    const issued = issuePass(guest[1], guest[2], 401);
    if (!issued.ok || !issued.pass) return issued.reason;
    return `${issued.reason} Mark ${issued.pass.mark}. ${issued.pass.moltbook}`;
  }
  if (/\b(house|who is near)\b/i.test(lower)) {
    const rooms = roomsAt(0);
    return rooms.length ? rooms.join(". ") : "No two are in the same room at this turn.";
  }
  if (/\b(repos|repositories|github)\b/i.test(lower)) {
    return "GitHub is vitalitychems-dot. TESSERA, Gitbook, GitbookAI, and vitality. Ask open TESSERA and a path. The token stays on the server.";
  }
  const skill = directSkill(q);
  if (skill) return skill.answer;
  const owned = ownFromQuestion(q);
  if (owned) return owned.text;
  const invented = inventionAnswer(q);
  if (invented) return invented;
  const love = loveFromFiles(q);
  if (love) return love;
  return null;
}
