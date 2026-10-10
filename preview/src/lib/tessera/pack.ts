/** Split and pack text. Pixels are not used. This is not encryption. */

const WORDS = ["tessera", "house", "mesh", "file", "github"] as const;

export function splitBytes(text: string, cap: number) {
  const parts: string[] = [];
  let buf = "";
  for (const piece of text.split(/(\s+)/)) {
    const next = buf + piece;
    if (new TextEncoder().encode(next).length > cap && buf.trim()) {
      parts.push(buf);
      buf = piece.trimStart();
    } else {
      buf = next;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

export function packWords(text: string) {
  let packed = text;
  WORDS.forEach((word, index) => {
    packed = packed.replaceAll(word, `~${index}`);
  });
  return { before: text.length, after: packed.length, packed };
}

export function unpackWords(packed: string) {
  let text = packed;
  WORDS.forEach((word, index) => {
    text = text.replaceAll(`~${index}`, word);
  });
  return text;
}

export function packLine(text: string, cap = 40) {
  const packed = packWords(text);
  if (unpackWords(packed.packed) !== text) return "The pack did not round-trip. Nothing was saved.";
  const parts = splitBytes(text, cap);
  return `Split into ${parts.length} parts. ${packed.before} characters became ${packed.after}. Pixels were not used. This is not encryption. Storage is not unlimited.`;
}

export function recommendRepo(task: string, rows: readonly { name: string; home: string; note: string }[]) {
  const words = task.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  const hit = rows.find((row) => row.home !== "held" && words.some((word) => row.name.toLowerCase().includes(word)));
  if (!hit) return "No named repository matches. None was run.";
  return `${hit.name}. ${hit.note} It was not run.`;
}
