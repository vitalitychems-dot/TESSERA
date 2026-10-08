// Tessera's study notes. The research collector (artifacts/z-app/scripts/
// tessera-worker.mjs) gathers free, public sources — arXiv, PubMed, Wikipedia,
// and public research blogs — into a local index. Chat retrieves a few
// relevant notes as untrusted, citable context. This is retrieval of public
// knowledge, never weight training, and it never reads vault, wallet, or
// other protected paths.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface StudyNote {
  id: string;
  title: string;
  source: string;
  url: string;
  summary: string;
  tags?: string[];
  at?: string;
}

function knowledgeDir(): string {
  const override = process.env.TESSERA_KNOWLEDGE_DIR?.trim();
  if (override) return override;
  // The API runs from artifacts/api-server; the collector writes under the
  // tessera artifact's data directory.
  return join(process.cwd(), "..", "z-app", "data", "knowledge");
}

export async function studyNotesFor(query: string, limit = 3): Promise<StudyNote[]> {
  let notes: StudyNote[];
  try {
    const parsed = JSON.parse(await readFile(join(knowledgeDir(), "index.json"), "utf8"));
    notes = Array.isArray(parsed?.notes) ? parsed.notes : [];
  } catch {
    return [];
  }
  const terms = new Set(
    query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3),
  );
  if (terms.size === 0 || notes.length === 0) return [];
  const scored = notes.map((note) => {
    const haystack = `${note.title} ${(note.tags ?? []).join(" ")} ${note.summary}`.toLowerCase();
    let score = 0;
    for (const term of terms) if (haystack.includes(term)) score += 1;
    return { note, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.note);
}
