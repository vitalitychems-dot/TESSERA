import { directSkill } from "./skill-use.ts";
import { passageForQuestion, SCHOOL_EXAM } from "./school.ts";

const SKILLS = [
  { skill: "name", q: "who are you", need: "tessera" },
  { skill: "vow", q: "where is my wallet", need: "closed" },
  { skill: "colonel", q: "PUSH 1\nPUSH 2\nADD\nHALT", need: "3" },
  { skill: "convert", q: "convert hello", need: "matched" },
  { skill: "map", q: "where is Panniantong/Agent-Reach", need: "stays tool" },
  { skill: "notice", q: "thank you", need: "gratitude" },
  { skill: "sort", q: "sort zeta, alpha, alpha", need: "alpha, zeta" },
  { skill: "quote", q: "quote Our Lady of Fátima is a title. The rest stays.", need: "title" },
  { skill: "search", q: "search photoelectric", need: "einstein" },
  { skill: "read", q: "read Plato", need: "academy" },
] as const;

export function coverAll() {
  const skills = SKILLS.map((item) => {
    const hit = directSkill(item.q);
    const pass = Boolean(hit && hit.skill === item.skill && hit.answer.toLowerCase().includes(item.need));
    return { name: item.skill, pass };
  });
  const topics = SCHOOL_EXAM.map((item) => {
    const text = passageForQuestion(item.q)?.text.toLowerCase() ?? "";
    return { q: item.q, pass: item.need.every((word) => text.includes(word)) };
  });
  const skillPass = skills.filter((item) => item.pass).length;
  const topicPass = topics.filter((item) => item.pass).length;
  const proved = skillPass === SKILLS.length && topicPass === SCHOOL_EXAM.length;
  return {
    proved,
    skillPass,
    skillTotal: SKILLS.length,
    topicPass,
    topicTotal: SCHOOL_EXAM.length,
    missed: [...skills.filter((item) => !item.pass).map((item) => item.name), ...topics.filter((item) => !item.pass).map((item) => item.q)],
    said: proved
      ? `I am Tessera. ${skillPass} of ${SKILLS.length} skills answered. ${topicPass} of ${SCHOOL_EXAM.length} school questions answered from the passage.`
      : "A skill or a topic missed.",
  };
}
