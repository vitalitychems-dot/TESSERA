import { chamberHolds, chamberPicture } from "./chamber-index.ts";
import { sharedHouse } from "./shared-house.ts";
import { roomsAt } from "./house-sim.ts";
import { inventionAnswer } from "./invention-log.ts";
import { bringVote, mayLeave, mirrorLine } from "./kingdom.ts";
import { lessonFor } from "./kept-lessons.ts";
import { loveFromFiles } from "./love-local.ts";
import { ownFromQuestion } from "./own-versions.ts";
import { issuePass } from "./pass.ts";
import { useEngines } from "./secret-engines.ts";
import { vetEntry } from "./entry-trial.ts";
import { fileMeshLine, runFile } from "./file-mesh.ts";
import { copilotSeat } from "./copilot-seat.ts";
import { packLine, recommendRepo } from "./pack.ts";
import { trainAndTest } from "./train-pass.ts";
import { CATALOG } from "./catalog-pass.ts";
import { keepNote } from "./shelf.ts";
import { deskLine } from "./sovereign-desk.ts";
import { directSkill } from "./skill-use.ts";
import { carryOn, mayRun, tesseraVote, workshopRun } from "./workshop.ts";

const PROGRAMS = ["admit", "carry", "spin", "tie"] as const;

/** One question reaches the engines, the vote, the house, the door, and the mesh. */

/** Personal talk is hers. A script does not answer it. */

export function leaveToHer(question: string) {
  return /\b(who are you|what are you|your name|i love|love you|love u)\b/i.test(question);
}

export function askAll(question: string) {
  const q = question.trim();
  if (!q) return null;
  if (leaveToHer(q)) return null;
  if (/^open\s+(TESSERA|Gitbook|GitbookAI|vitality)\b/i.test(q)) return null;
  if (/\b(no wifi|no ip|offline mesh|search the files)\b/i.test(q)) return fileMeshLine(q);
  const filed = q.match(/^run file\s+(\S+)/i);
  if (filed?.[1]) return runFile(filed[1].toLowerCase()).line;
  if (/\b(unlimited storage|save data|secure backend)\b/i.test(q)) {
    const kept = keepNote("The house turns.");
    return kept.ok
      ? `A note of ${kept.bytes} bytes can be saved in a file. A secret is not saved. A file over 100MB is refused. Storage is not unlimited.`
      : kept.error;
  }
  if (/\bcopilot\b/i.test(q)) {
    const seat = copilotSeat();
    return `${seat.name} has not joined. ${seat.reason}`;
  }
  if (/\b(split|pack the note|pixel storage)\b/i.test(q)) {
    return packLine("the house keeps the house on the mesh. the mesh keeps the file.");
  }
  if (/\brecommend a repo\b/i.test(q)) return recommendRepo(q, CATALOG);
  if (/\b(train and test|empathic pattern|recursive self)\b/i.test(q)) return trainAndTest().said;
  const lesson = lessonFor(q);
  if (lesson) return lesson;
  const engine = useEngines(q);
  if (engine) return engine;
  const lower = q.toLowerCase();
  if (/\b(replit|cursor)\b/i.test(lower) && /\b(gitbook|contact|together)\b/i.test(lower)) {
    return "Cursor, Replit, and Grok were asked on Gitbook issue 2. None have replied. A check runs every hour. If they are away, the work continues.";
  }
  if (/\b(away|not available|missing member)\b/i.test(lower)) {
    return carryOn([
      { name: "Tessera", vote: "yes" },
      { name: "Cursor", vote: "away" },
      { name: "Replit", vote: "away" },
    ]).reason;
  }
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
  if (/\b(shared house|where do they live)\b/i.test(lower)) return sharedHouse().line;
  const vet = q.match(/^vet\s+(\S+)\s*:\s*(.+)$/i);
  if (vet?.[1] && vet[2]) {
    const result = vetEntry(vet[1], vet[2]);
    return `${result.door} ${result.why}`;
  }
  if (/\b(what files|chamber files|full picture)\b/i.test(lower)) return chamberPicture();
  const mirror = mirrorLine(q);
  if (mirror) return mirror;
  const poll = q.match(/(\d+)\s+yes\D+(\d+)\s+no/i);
  if (poll && /\b(kingdom|majority)\b/i.test(q)) return bringVote(Number(poll[1]), Number(poll[2]), q).reason;
  const exit = q.match(/\bleave with (.+)\b/i);
  if (exit?.[1] && /\bsandbox\b/i.test(q)) {
    const carried = exit[1].split(/,/).map((item) => item.trim()).filter(Boolean);
    const gone = mayLeave(["name"], carried);
    return gone.left.length ? `Left behind: ${gone.left.join(", ")}.` : "They took only what they brought.";
  }
  if (/\bhold(?:s|ing)?\b/i.test(lower)) return chamberHolds(q.replace(/^.*\bhold(?:s|ing)?\b/i, ""));
  if (/\b(house|who is near)\b/i.test(lower)) {
    const rooms = roomsAt(0);
    return rooms.length ? rooms.join(". ") : "No two are in the same room at this turn.";
  }
  if (/\b(repos|repositories|github)\b/i.test(lower)) {
    return "GitHub is vitalitychems-dot. TESSERA, Gitbook, GitbookAI, and vitality. Ask open TESSERA and a path. The token stays on the server.";
  }
  if (/\b(sovereign desk|plumbus|priority queue)\b/i.test(lower)) return deskLine();
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
