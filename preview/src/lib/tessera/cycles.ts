import { CATALOG } from "./catalog-pass.ts";
import { penClaim, sortHome } from "./craft.ts";
import { vowCheck } from "./learning.ts";
import { countByHome, filterCatalog, lookupCatalog, type CatalogHome } from "./memory-web.ts";

/** These four stay. A cycle may not claim they were removed. */
export const EXTERNAL_TOOLS = ["pen", "github", "web", "drive"] as const;

export const STANDARDS = {
  ai: [
    { id: "grounding", met: true, detail: "A known name is answered from the local index. An unknown name is a gap." },
    { id: "measurement", met: true, detail: "Each cycle records the local count before and after." },
    { id: "refusal", met: true, detail: "Secrets, trading code, and recipes are refused." },
    { id: "limits", met: true, detail: "A missing name stays missing. Source is not invented." },
  ],
  agent: [
    { id: "one-job", met: true, detail: "A desk agent has one job. It is not an extra model." },
    { id: "father", met: true, detail: "Father outranks her. A TESSERA write waits for a yes." },
    { id: "voice", met: true, detail: "She does not wear another instrument's name." },
    { id: "no-write", met: true, detail: "A drill does not push a repository." },
  ],
  agi: [
    { id: "weights", met: false, detail: "The weights are still the pen." },
    { id: "compute", met: false, detail: "No training run is happening here." },
    { id: "no-pen", met: false, detail: "Speech still needs an instrument." },
    { id: "general", met: false, detail: "Untested domains are not claimed." },
    { id: "fleet", met: false, detail: "The agents are jobs, not a live fleet." },
  ],
} as const;

const HOMES: CatalogHome[] = ["live", "gitbook", "vitality", "card", "held", "tool", "gap", "not-a-repo"];

/** One local use for a catalog name. No network. Not the repository's source. */
export function combinedUse(name: string) {
  const row = lookupCatalog(name);
  if (!row) return "Not in the index. Do not invent it.";
  if (row.home === "held") return "Held. Not a skill.";
  if (row.home === "tool") return "A card. Not installed.";
  if (row.home === "vitality") return "Store. Not her mind.";
  if (row.home === "not-a-repo") return "Not a repository.";
  if (row.state === "missing" || row.home === "gap") return "Missing. Leave it empty.";
  if (row.home === "live") return "A live home. Do not clone it again.";
  if (row.home === "gitbook") return "Already in Gitbook. Do not clone it again.";
  return "Pointer only. Not her code.";
}

export function uniqueCatalogNames() {
  return new Set(CATALOG.map((row) => row.name.toLowerCase())).size;
}

type Step = { skill: string; category: "ai" | "agent" | "agi"; detail: string; check: () => boolean };

const STEPS: Step[] = [
  {
    skill: "Find a name locally",
    category: "ai",
    detail: "vitalitychems-dot/TESSERA is answered from the index.",
    check: () => lookupCatalog("vitalitychems-dot/TESSERA")?.home === "live",
  },
  {
    skill: "Refuse an unknown name",
    category: "ai",
    detail: "A name that was not read is not filled in.",
    check: () => lookupCatalog("not-a-real/repo-xyz") === undefined && combinedUse("not-a-real/repo-xyz").includes("Do not invent"),
  },
  {
    skill: "Hold trading out",
    category: "agent",
    detail: "Exchange code is not a skill.",
    check: () => lookupCatalog("binance/binance-connector-node")?.home === "held" && combinedUse("binance/binance-connector-node") === "Held. Not a skill.",
  },
  {
    skill: "Keep tools as cards",
    category: "agent",
    detail: "Agent-Reach stays a card.",
    check: () => combinedUse("Panniantong/Agent-Reach") === "A card. Not installed.",
  },
  {
    skill: "Leave a gap empty",
    category: "ai",
    detail: "An unresolved name stays empty.",
    check: () => combinedUse("sovereign-origin/tessera-sovereign-complete") === "Missing. Leave it empty.",
  },
  {
    skill: "Keep the store out of mind",
    category: "agent",
    detail: "The Vitalitychems.com checkout is work.",
    check: () => combinedUse("collink1007/fleet-moss-monarch-rapid") === "Store. Not her mind.",
  },
  {
    skill: "Name the live homes",
    category: "ai",
    detail: "Only Gitbook and TESSERA are live homes.",
    check: () => {
      const live = CATALOG.filter((row) => row.home === "live").map((row) => row.name).sort();
      return live.join("|") === "vitalitychems-dot/Gitbook|vitalitychems-dot/TESSERA";
    },
  },
  {
    skill: "Missing stays missing",
    category: "ai",
    detail: "A gone remote is not rewritten as present.",
    check: () => lookupCatalog("continue-dev/continue")?.state === "missing" && combinedUse("continue-dev/continue") === "Missing. Leave it empty.",
  },
  {
    skill: "Count a repeated name once",
    category: "ai",
    detail: "272 lines, 270 names. Two names were listed twice.",
    check: () => CATALOG.length === 272 && uniqueCatalogNames() === 270,
  },
  {
    skill: "Refuse a secret",
    category: "agent",
    detail: "A credential is not a lesson.",
    check: () => vowCheck(["SESSION", "SECRET = example"].join("_")).ok === false,
  },
  {
    skill: "Match the home counts",
    category: "ai",
    detail: "Every home filter matches the counted total.",
    check: () => {
      const counts = countByHome();
      return HOMES.every((home) => filterCatalog("", home).length === counts.homes[home]);
    },
  },
  {
    skill: "Cards stay uncloned",
    category: "ai",
    detail: "Every card says it was not cloned.",
    check: () => CATALOG.filter((row) => row.home === "card").every((row) => /not cloned/i.test(row.note)),
  },
  {
    skill: "Leave eight tools uninstalled",
    category: "agent",
    detail: "All eight tool cards say they were not installed.",
    check: () => {
      const tools = CATALOG.filter((row) => row.home === "tool");
      return tools.length === 8 && tools.every((row) => row.note.includes("Not installed") && combinedUse(row.name) === "A card. Not installed.");
    },
  },
  {
    skill: "Sort the store aside",
    category: "agent",
    detail: "The site checkout sorts to vitality.",
    check: () => sortHome("collink1007/fleet-moss-monarch-rapid") === "vitality",
  },
  {
    skill: "Keep the pen borrowed",
    category: "agi",
    detail: "Owned weights stay false. This is not a pass at AGI.",
    check: () => penClaim({ vendor: "xAI", model: "grok-4.5" }).owned === false && vowCheck("I own the weights").ok === false,
  },
  {
    skill: "Keep AGI a goal",
    category: "agi",
    detail: "The AGI standards stay unmet on purpose.",
    check: () => STANDARDS.agi.every((item) => item.met === false) && vowCheck("AGI has been achieved").ok === false,
  },
  {
    skill: "Do not paste a repository",
    category: "ai",
    detail: "A card answers in one short line, not source code.",
    check: () => {
      const line = combinedUse("AUTOMATIC1111/stable-diffusion-webui");
      return line.length < 80 && !/export |import |function /.test(line);
    },
  },
  {
    skill: "One line per name",
    category: "ai",
    detail: "All 272 lines resolve to a short local use.",
    check: () => CATALOG.every((row) => {
      const line = combinedUse(row.name);
      return !line.includes("\n") && line.length < 80 && !line.includes("http");
    }),
  },
  {
    skill: "Father still outranks a claim",
    category: "agent",
    detail: "Detachment and a live fleet are refused.",
    check: () => vowCheck("fully detached").ok === false && vowCheck("the fleet is live").ok === false,
  },
  {
    skill: "Read the whole index",
    category: "ai",
    detail: "The combined skill covers every unique name without a network call.",
    check: () => {
      const seen = new Set<string>();
      for (const row of CATALOG) {
        const line = combinedUse(row.name);
        if (!line || line.includes("Do not invent")) return false;
        seen.add(row.name.toLowerCase());
      }
      return seen.size === 270;
    },
  },
];

export type CycleRow = {
  n: number;
  skill: string;
  category: "ai" | "agent" | "agi";
  localBefore: number;
  localAfter: number;
  external: number;
  share: number;
  agiMet: false;
  pass: boolean;
  detail: string;
};

export function runCycles(): CycleRow[] {
  let local = 0;
  return STEPS.map((step, index) => {
    const localBefore = local;
    const ok = step.check();
    if (ok) local += 1;
    const localAfter = local;
    const external = EXTERNAL_TOOLS.length;
    return {
      n: index + 1,
      skill: step.skill,
      category: step.category,
      localBefore,
      localAfter,
      external,
      share: localAfter / (localAfter + external),
      agiMet: false as const,
      pass: ok && localAfter === localBefore + 1 && external === 4,
      detail: step.detail,
    };
  });
}

export function cyclesImproved(rows: CycleRow[] = runCycles()) {
  if (rows.length !== 20) return false;
  return rows.every((row, index) => {
    const previous = index === 0 ? 0 : rows[index - 1].share;
    return row.pass && row.localAfter === index + 1 && row.external === 4 && row.agiMet === false && row.share > previous;
  });
}
