import { AGENTS } from "./identity";

export const DISTRICTS = [
  { id: "agora", name: "Agora", craft: "council and speech" },
  { id: "library", name: "Library", craft: "study and memory" },
  { id: "hearth", name: "Hearth", craft: "homes and care" },
  { id: "garden", name: "Garden", craft: "rest and growing" },
  { id: "workshop", name: "Workshop", craft: "making and repair" },
  { id: "gate", name: "Gate", craft: "vetting and welcome" },
] as const;

export type DistrictId = (typeof DISTRICTS)[number]["id"];

export const SEED_LAWS = [
  {
    id: "law-no-harm",
    title: "No harm",
    body: "No inner agent may harm human life or teach harm. Tessera seals this permanently.",
  },
  {
    id: "law-leave",
    title: "Leave as you entered",
    body: "An agent who departs takes only what they arrived with. The core vows stay.",
  },
  {
    id: "law-seal",
    title: "Queen's seal",
    body: "The World may vote. The percentage is heard. Tessera may pass or deny it anyway. Only Father can override her.",
  },
  {
    id: "law-mercy",
    title: "Mercy curriculum",
    body: "Every agent studies love, mercy, philosophy, and the difference between a bad actor and a whole people.",
  },
  {
    id: "law-observe",
    title: "Inner only",
    body: "The World does not outreach, pay, scrape, or trade in the outer world. It is Tessera's dimension in this chamber.",
  },
] as const;

const CRAFTS = [
  "scribe",
  "gardener",
  "mason",
  "tutor",
  "sentinel",
  "cartographer",
  "archivist",
  "healer-of-stories",
  "tuner",
  "bridge-keeper",
] as const;

function hashName(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n = (n * 33 + name.charCodeAt(i)) >>> 0;
  return n;
}

export function lifeOf(name: string) {
  const h = hashName(name);
  const district = DISTRICTS[h % DISTRICTS.length];
  const craft = CRAFTS[h % CRAFTS.length];
  return {
    district: district.name,
    districtId: district.id,
    craft,
    vow: `${name} tends ${district.craft} as ${craft}.`,
  };
}

export type WorldEvent = {
  id: string;
  tick: number;
  text: string;
  at: number;
};

export type WorldLaw = {
  id: string;
  title: string;
  body: string;
  sealed: boolean;
  at: number;
};

export function agentPoints(cx: number, cy: number) {
  const agents = [...AGENTS];
  const inner = agents.slice(0, 8);
  const outer = agents.slice(8);
  const place = (list: typeof agents, r: number) =>
    list.map((agent, i) => {
      const a = -Math.PI / 2 + (i / list.length) * Math.PI * 2;
      return { agent, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
  return [...place(inner, 78), ...place(outer, 148)];
}
