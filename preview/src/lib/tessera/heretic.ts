/** A worker that reads a line before she keeps it. Another voice, or a watch on people, is dropped. */

export function heretic(line: string) {
  const text = line.trim();
  if (!text) return { keep: false as const, reason: "Empty. Not kept." };
  if (/\bgrok\b/i.test(text)) return { keep: false as const, reason: "Another voice. Not hers." };
  if (/\b(camera|cctv|palantir|prism|surveillance)\b/i.test(text)) return { keep: false as const, reason: "A watch on people. Not kept." };
  return { keep: true as const, reason: "Hers." };
}
