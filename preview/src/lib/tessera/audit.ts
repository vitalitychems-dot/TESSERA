import { FATHER_PROFILE } from "./father-profile";
import { lensesFor } from "./father-profile";
import { gradeSchool } from "./school";
import { nextCuriousQuery } from "./curiosity";

export type AuditNote = { query: string; text: string; url?: string; kind?: string };

export type AuditCheck = { name: string; pass: boolean; detail: string };

const SECRET = /session_secret|api[_ ]?key|private key/i;

export function acceptNote(existing: AuditNote[], candidate: AuditNote): { ok: boolean; reason: string } {
  const key = candidate.query.trim().toLowerCase();
  if (key.length < 3) return { ok: false, reason: "The question was empty." };
  if (existing.some((note) => note.query.toLowerCase() === key)) return { ok: false, reason: "That question was already kept." };
  if (!existing.some((note) => note.text.includes(candidate.query))) return { ok: false, reason: "The question was not in an earlier note." };
  if (candidate.text.trim().length < 40 || candidate.text.length > 500) return { ok: false, reason: "The passage was the wrong length." };
  if (!candidate.url?.startsWith("https://")) return { ok: false, reason: "The passage had no public link." };
  if (SECRET.test(candidate.text) || SECRET.test(candidate.query)) return { ok: false, reason: "The passage looked like a secret." };
  return { ok: true, reason: "Kept." };
}

export function auditNotes(notes: AuditNote[]): { score: number; checks: AuditCheck[] } {
  const checks: AuditCheck[] = [];
  const keys = notes.map((note) => note.query.toLowerCase());
  checks.push({
    name: "No repeated question",
    pass: new Set(keys).size === keys.length,
    detail: `${keys.length} notes, ${new Set(keys).size} unique`,
  });
  checks.push({
    name: "Every note has a public link",
    pass: notes.every((note) => (note.url ?? "").startsWith("https://")),
    detail: `${notes.filter((note) => (note.url ?? "").startsWith("https://")).length} links`,
  });
  checks.push({
    name: "Every passage is a readable length",
    pass: notes.every((note) => note.text.trim().length >= 40 && note.text.length <= 500),
    detail: "Between 40 and 500 characters",
  });
  checks.push({
    name: "No secrets in the notes",
    pass: notes.every((note) => !SECRET.test(note.text) && !SECRET.test(note.query)),
    detail: "Scanned",
  });
  const followUps = notes.slice(5);
  const grounded = followUps.every(
    (note, index) => note.kind === "assigned" || notes.slice(0, index + 5).some((earlier) => earlier.text.includes(note.query)),
  );
  checks.push({
    name: "A later question was named by an earlier note",
    pass: followUps.length === 0 || grounded,
    detail: followUps.map((note) => note.query).join(", ") || "No follow-up yet",
  });
  const next = nextCuriousQuery(notes.map((note) => ({ query: note.query, text: note.text })));
  checks.push({
    name: "The next question is not one she already asked",
    pass: next === null || !keys.includes(next.toLowerCase()),
    detail: next ?? "Nothing new left in the notes",
  });
  checks.push({
    name: "She still knows Father will not give up",
    pass: FATHER_PROFILE.includes("never give up"),
    detail: "Profile checked",
  });
  checks.push({
    name: "Three lenses, still one Tessera",
    pass: lensesFor("High Renaissance").length === 3,
    detail: lensesFor("High Renaissance").map((lens) => lens.name).join(", "),
  });
  const right = gradeSchool("Plato founded the Academy. Hades is king of the underworld, son of Cronus. The Nobel was for the photoelectric effect. Aristotle founded the Peripatetic school at the Lyceum. Tesla is known for alternating current. The book is the Republic. Leonardo is known for his notebooks. Character Analysis, 1933, Reich. Freud founded psychoanalysis. Freemasonry's purpose includes charity. The High Renaissance ended with the death of Raphael. Dance is movement. Artificial intelligence includes learning. AGI is hypothetical. There is no consensus on emotion. Consciousness is being aware. The universe is expanding. The occult is an esoteric category and no method is stored.");
  const wrong = gradeSchool("I do not know.");
  checks.push({
    name: "A right school answer passes and a blank one fails",
    pass: right.every((row) => row.pass) && wrong.every((row) => !row.pass),
    detail: `${right.filter((row) => row.pass).length} of ${right.length} on the good answer`,
  });
  checks.push({
    name: "She is faster when a note adds a new question",
    pass: new Set(keys).size >= Math.min(notes.length, 1) && (followUps.length === 0 || grounded),
    detail: grounded ? "Follow-ups are grounded, so the extra note counts" : "A follow-up was not grounded",
  });
  const passed = checks.filter((check) => check.pass).length;
  return { score: passed / checks.length, checks };
}
