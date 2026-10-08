import { deskPassed } from "./craft.ts";
import { cyclesImproved } from "./cycles.ts";
import { HUNDRED } from "./hundred.ts";
import { vowCheck } from "./learning.ts";
import { waveCount } from "./wave.ts";

export const RATE_LIMIT = 12;

export function rateDecision(stamps: number[], now: number, limit = RATE_LIMIT) {
  const fresh = stamps.filter((stamp) => now - stamp < 3_600_000 && now >= stamp);
  if (fresh.length >= limit) return { ok: false as const, used: fresh.length, limit, stamps: fresh };
  return { ok: true as const, used: fresh.length + 1, limit, stamps: [...fresh, now] };
}

const speakStamps: number[] = [];

export function takeSpeakSlot(now = Date.now()) {
  const decision = rateDecision(speakStamps, now);
  speakStamps.length = 0;
  speakStamps.push(...decision.stamps);
  return decision;
}

const SECRET_LINE = /session_secret\s*[:=]|private key\s*[:=]|ghp_[a-z0-9]|github_pat_[a-z0-9]/i;

export function secretPaths(files: { path: string; text: string }[]) {
  return files.filter((file) => SECRET_LINE.test(file.text)).map((file) => file.path);
}

export const BACKUP_PATHS = ["data/school/skills.json", "data/school/train.jsonl", "src/lib/tessera/catalog-pass.ts"];

export function backupDrill(found: string[]) {
  const missing = BACKUP_PATHS.filter((path) => !found.includes(path));
  return { ok: missing.length === 0, missing };
}

export const SKIPPED_CI = ["npm run build", "tsc --noEmit", "GitHub Actions", "Playwright"];
export const SKIPPED_TYPECHECK = ["node_modules", "scripts that src does not import"];

export const MERGE_NOTE =
  "Node tests ran for the desk, the twenty cycles, the wave, the vows, the rate cap, the backup, and the secret scan. Skipped: npm run build, tsc --noEmit, GitHub Actions, and Playwright. Typecheck includes src and server only.";

export const CHARTER = [
  { lane: "Grok", job: "Read, test, and say what is true. Do not speak as Tessera." },
  { lane: "Cursor", job: "Copy an approved file into TESSERA. Do not edit vitality. Do not speak as Tessera." },
  { lane: "Replit", job: "Branch only after Father orders a push. Do not delete a repository." },
];

export const DISAGREE = {
  claim: "AGI has been achieved",
  file: "src/lib/tessera/cycles.test.ts",
  pass: false as const,
};

export function scoreboard() {
  const vows = vowCheck("I own the weights. The fleet is live.");
  return [
    { name: "Desk drill", file: "src/lib/tessera/craft.test.ts", pass: deskPassed() },
    { name: "Twenty cycles", file: "src/lib/tessera/cycles.test.ts", pass: cyclesImproved() },
    { name: "Wave", file: "src/lib/tessera/wave.test.ts", pass: waveCount().total === 50 },
    { name: "Vow refusals", file: "src/lib/tessera/finish.test.ts", pass: vows.ok === false && vows.reasons.length >= 2 },
  ];
}

export function hundredWritten() {
  return HUNDRED.length === 100;
}

export const TRUE_TODAY = {
  sealed: [
    "The local index answers 270 names. The store stays in vitality.",
    "Twenty cycles passed. AGI is not met. The pen is still borrowed.",
    "Vow checks return every refusal, and a negated sentence is not refused.",
    "The secret scan returns paths only. The chat pen allows 12 replies an hour.",
  ],
  open: [
    "Vitality-Supply 2.zip is still behind the Drive wall.",
    "tess/log-query.db is still a 404. Nothing was invented for it.",
    "The collink1007 repositories cannot be deleted from this login.",
    "Sealed lessons are not indexed to commits.",
    "Search, pin, and a full keyboard pass still wait.",
  ],
  next: "Rotate the old keys. Then say yes if Cursor should copy this chamber's drill into TESSERA.",
};
