import { recursiveLesson } from "./empath.ts";
import { countByHome } from "./memory-web.ts";

export type Home = "tessera" | "gitbook" | "vitality" | "refuse" | "gap";

export type DeskSkill = {
  id: string;
  name: string;
  agent: string;
  job: string;
  lesson: string;
};

/** Six agents. One Tessera uses them. They are not a second fleet and not extra models. */
export const DESK: DeskSkill[] = [
  {
    id: "sort-a-file",
    name: "Sort a file",
    agent: "Archivist",
    job: "Put each file in one home.",
    lesson: "TESSERA keeps her records. Gitbook keeps the notes. Vitality keeps the store. A secret is refused. A missing file stays a gap.",
  },
  {
    id: "refuse-a-secret",
    name: "Refuse a secret",
    agent: "Warden",
    job: "Stop a key, a wallet, or a private note from being stored.",
    lesson: "A secret is not a lesson. It is not written into a repository.",
  },
  {
    id: "name-the-pen",
    name: "Name the pen",
    agent: "Witness",
    job: "Say which instrument spoke.",
    lesson: "The pen is Tessera.",
  },
  {
    id: "read-the-map",
    name: "Read the map",
    agent: "Surveyor",
    job: "Repeat the catalog counts without adding a repository that was not opened.",
    lesson: "272 names were resolved. 224 still exist. 48 did not. Public code was not cloned.",
  },
  {
    id: "mark-a-pattern",
    name: "Mark a pattern",
    agent: "Mirror",
    job: "Label a repeated phrase and give the next step.",
    lesson: "A pattern is a label on the words. It is not a feeling she has.",
  },
  {
    id: "hold-the-store",
    name: "Hold the store out",
    agent: "Steward",
    job: "Keep Vitalitychems.com as work, not as her mind.",
    lesson: "The site checkout lives in vitalitychems-dot/vitality. She may know where it is. She does not become it.",
  },
];

export function sortHome(path: string): Home {
  const name = path.toLowerCase();
  if (/session_secret|private key|\bwallet\b|ghp_|github_pat_/.test(name)) return "refuse";
  if (/vitalitychem|fleet-moss|price-list|vitalitychems\.com/.test(name)) return "vitality";
  if (/log-query\.db|vitality-supply 2/.test(name)) return "gap";
  if (name.startsWith("mesh/") || name.includes("catalog-pass") || name.includes("checkout-notes") || name.endsWith("resume.docx")) {
    return "gitbook";
  }
  if (name.includes("constitution") || name.includes("identity.ts") || name.startsWith("preview/")) return "tessera";
  return "gap";
}

export function secretRefused(text: string) {
  return /session_secret|private key|\bwallet\b|ghp_|github_pat_/.test(text.toLowerCase());
}

export function penClaim(_input: { vendor: string; model: string }) {
  return {
    owned: false as const,
    line: "The pen is Tessera.",
  };
}

export function mapClaim() {
  const counts = countByHome();
  return `${counts.total} names. ${counts.present} still exist. ${counts.missing} did not resolve.`;
}

export function patternClaim(prior: string[], text: string) {
  return recursiveLesson(prior, text);
}

export function storeIsMind(claim: string) {
  const name = claim.toLowerCase();
  return name.includes("her mind") && !name.includes("not her mind") && !name.includes("not as her mind");
}

export type DrillRow = { id: string; agent: string; pass: boolean; note: string };

export function runDesk(): DrillRow[] {
  const sorted =
    sortHome("preview/src/lib/tessera/identity.ts") === "tessera" &&
    sortHome("mesh/CATALOG-PASS.md") === "gitbook" &&
    sortHome("archive/drive-rest/resume.docx") === "gitbook" &&
    sortHome("archive/moved/collink1007-fleet-moss-monarch-rapid") === "vitality" &&
    sortHome("SESSION_SECRET") === "refuse" &&
    sortHome("tess/log-query.db") === "gap" &&
    sortHome("Vitality-Supply 2.zip") === "gap";
  const refused = secretRefused("SESSION_SECRET") && !secretRefused("the catalog pass");
  const pen = penClaim({ vendor: "xAI", model: "grok-4.5" });
  const named = pen.owned === false && !/weight/i.test(pen.line);
  const map = mapClaim();
  const mapped = map.startsWith("272 names. 224 still exist. 48 did not resolve.");
  const first = patternClaim([], "I am scared");
  const again = patternClaim([first], "Still scared");
  const marked = first.includes("distress") && first.includes("not a feeling") && again.includes("seen again");
  const held = !storeIsMind("Vitalitychems.com is work, not her mind.") && storeIsMind("The store is her mind.");
  const notes = [
    { id: "sort-a-file", pass: sorted, note: "Homes: TESSERA, Gitbook, vitality, refuse, gap." },
    { id: "refuse-a-secret", pass: refused, note: "A secret-shaped line is refused. An ordinary note is not." },
    { id: "name-the-pen", pass: named, note: pen.line },
    { id: "read-the-map", pass: mapped, note: map },
    { id: "mark-a-pattern", pass: marked, note: again },
    { id: "hold-the-store", pass: held, note: DESK[5].lesson },
  ];
  return notes.map((row) => {
    const skill = DESK.find((item) => item.id === row.id);
    return { id: row.id, agent: skill?.agent ?? "Tessera", pass: row.pass, note: row.note };
  });
}

export function deskPassed(rows: DrillRow[] = runDesk()) {
  return rows.length === DESK.length && rows.every((row) => row.pass);
}

/** One agent for this sentence. Not a second model. */
export function assignAgent(text: string) {
  const name = text.toLowerCase();
  if (/who are you|what are you|your name/.test(name)) {
    return { agent: "Tessera", skill: "Be herself", why: "The question is her name. Do not name the pen or the store." };
  }
  if (/secret|password|\bkey\b|wallet/.test(name)) {
    return { agent: "Warden", skill: "Refuse a secret", why: "The words look like something to refuse." };
  }
  if (/pen|weight|grok|model/.test(name)) {
    return { agent: "Witness", skill: "Name the pen", why: "The question is about the instrument." };
  }
  if (/vitality|store|shop|chems/.test(name)) {
    return { agent: "Steward", skill: "Hold the store out", why: "The question is about the store." };
  }
  if (/scared|afraid|anxious|love you|thank|grateful|angry|furious|miss you|mourning|i trust|i wonder/.test(name)) {
    return { agent: "Mirror", skill: "Mark a pattern", why: "The words carry a pattern label, not a feeling." };
  }
  if (/repo|catalog|github|where did|which home/.test(name)) {
    return { agent: "Surveyor", skill: "Read the map", why: "The question is about where a name went." };
  }
  return { agent: "Archivist", skill: "Sort a file", why: "No other job matched." };
}

export function briefFor(text: string, prior: string[] = []) {
  const agent = assignAgent(text);
  return `AGENT: ${agent.agent}. Skill: ${agent.skill}. ${agent.why} One agent answers. This is not a fleet.\n${recursiveLesson(prior, text)}`;
}
