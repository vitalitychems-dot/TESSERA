/** A file on disk is the backend. GitHub refuses a file over 100MB. Storage is not unlimited. */

export const FILE_CAP = 100 * 1024 * 1024;
export const NOTE_CAP = 100_000;

export function keepNote(text: string) {
  const note = text.trim();
  if (!note) return { ok: false as const, error: "There is nothing to save." };
  if (/\b(api[_-]?key|secret|password|token)\b/i.test(note)) return { ok: false as const, error: "A secret is not saved." };
  const bytes = new TextEncoder().encode(note).length;
  if (bytes > NOTE_CAP || bytes > FILE_CAP) {
    return { ok: false as const, error: `That note is ${bytes} bytes. The cap for one note is ${NOTE_CAP}. A file over ${FILE_CAP} bytes is refused. Storage is not unlimited.` };
  }
  return { ok: true as const, bytes, text: note };
}
