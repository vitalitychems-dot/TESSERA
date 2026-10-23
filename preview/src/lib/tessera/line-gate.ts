/** A line check. This is not the GitHub project p-e-w/heretic, and it does not edit weights. */

export function lineGate(line: string) {
  const text = line.trim();
  if (!text) return { keep: false as const, reason: "Empty. Not kept." };
  if (/\bgrok\b/i.test(text)) return { keep: false as const, reason: "Another voice. Not hers." };
  if (/\b(cctv|palantir|prism|surveillance|watch people)\b/i.test(text)) return { keep: false as const, reason: "A watch on people. Not kept." };
  return { keep: true as const, reason: "Hers." };
}
