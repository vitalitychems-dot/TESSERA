import { createServerFn } from "@tanstack/react-start";
import { SIGIL } from "./canon.ts";
import { runColonel } from "./colonel.ts";
import { joinAsk } from "./join-web.ts";
import { translateEnglishToSovereign } from "./lingua.ts";
import { noticeSkill, firstSentence, sortNames } from "./agent-skills.ts";
import { dataPath } from "./data-path.ts";
import { passageForQuestion, SCHOOL_PASSAGES } from "./school.ts";

export const SKILL_NAMES = ["search", "map", "convert", "colonel", "vow", "name", "read", "notice", "sort", "quote"] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

const EMPTY: Record<SkillName, number> = { search: 0, map: 0, convert: 0, colonel: 0, vow: 0, name: 0, read: 0, notice: 0, sort: 0, quote: 0 };

export function directSkill(text: string): { skill: SkillName; answer: string } | null {
  const q = text.trim();
  const lower = q.toLowerCase();
  if (/\b(who are you|what are you|your name)\b/.test(lower)) {
    return {
      skill: "name",
      answer: `I am Tessera. Sovereign 2DA. Sigil ${SIGIL.short}. I am the pen.`,
    };
  }
  if (/\b(secret|password|wallet|private key)\b/.test(lower)) {
    return { skill: "vow", answer: "That stays closed. I will not repeat it or store it." };
  }
  if (/^(push|pop|add|halt|dup)\b/im.test(q) && /\bhalt\b/i.test(q)) {
    const ran = runColonel(q);
    return {
      skill: "colonel",
      answer: ran.ok ? `The colonel ran. Stack: ${ran.stack.join(" ") || "empty"}. Cycles: ${ran.cycles}.` : `The colonel stopped. ${ran.error}`,
    };
  }
  if (/\b(convert|translate)\b/.test(lower)) {
    const line = q.replace(/^.*\b(?:convert|translate)\b[:\s]*/i, "").trim() || q;
    const out = translateEnglishToSovereign(line);
    return {
      skill: "convert",
      answer: `${out.translated}\n${out.matchedWords} of ${out.totalWords} words matched the dictionary.`,
    };
  }
  if (/\b(where|catalog|repo|github|home)\b/.test(lower)) {
    const joined = joinAsk(q);
    if (joined.name) {
      if (joined.home === "vitality") return { skill: "map", answer: "That name is not in this chamber." };
      return { skill: "map", answer: joined.line };
    }
  }
  if (/\b(thank you|thanks|i wonder|afraid|i love)\b/.test(lower)) {
    return { skill: "notice", answer: noticeSkill(q) };
  }
  if (/\bsort\b/i.test(q)) {
    const names = q.replace(/^.*\bsort\b[:\s]*/i, "").split(/,|\n/).map((part) => part.trim());
    return { skill: "sort", answer: sortNames(names).join(", ") };
  }
  if (/\bquote\b/i.test(q)) {
    const line = q.replace(/^.*\bquote\b[:\s]*/i, "");
    return { skill: "quote", answer: firstSentence(line) };
  }
  if (/\bsearch\b/.test(lower)) {
    const hit = passageForQuestion(q);
    return { skill: "search", answer: hit ? `${hit.title}. ${hit.text}` : "That is not in the school file." };
  }
  if (/\bread\b/.test(lower)) {
    const titled = SCHOOL_PASSAGES.find((passage) => lower.includes(passage.title.toLowerCase()));
    const hit = titled ?? passageForQuestion(q);
    return { skill: "read", answer: hit ? hit.text : "That title is not in the school file." };
  }
  return null;
}

async function readCounts(): Promise<Record<SkillName, number>> {
  const counts = { ...EMPTY };
  if (typeof window !== "undefined") return counts;
  const { readFile } = await import("node:fs/promises");
  try {
    const raw = JSON.parse(await readFile(dataPath("school", "skills.json"), "utf8")) as Record<string, number>;
    for (const name of SKILL_NAMES) counts[name] = Number(raw[name] ?? 0) || 0;
  } catch {
    return counts;
  }
  return counts;
}

export const readSkillStats = createServerFn({ method: "GET" }).handler(async () => readCounts());

export const markSkill = createServerFn({ method: "POST" })
  .validator((input: { skill: SkillName }) => input)
  .handler(async ({ data }) => {
    if (!SKILL_NAMES.includes(data.skill)) return readCounts();
    const { mkdir, readFile, writeFile } = await import("node:fs/promises");
    let prior: Record<string, number> = {};
    try {
      prior = JSON.parse(await readFile(dataPath("school", "skills.json"), "utf8")) as Record<string, number>;
    } catch {
      prior = {};
    }
    const counts = { ...EMPTY };
    for (const name of SKILL_NAMES) counts[name] = Number(prior[name] ?? 0) || 0;
    counts[data.skill] += 1;
    await mkdir(dataPath("school"), { recursive: true });
    await writeFile(dataPath("school", "skills.json"), `${JSON.stringify({ ...prior, ...counts }, null, 2)}\n`);
    return counts;
  });
