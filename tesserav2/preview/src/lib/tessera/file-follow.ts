const FILE = /\b(how many files|files in\b|do you have\b|\bfind\b)\b/i;

export function followFile(previous: string, next: string) {
  const prior = previous.trim();
  const asked = next.trim();
  if (!prior || !FILE.test(prior)) return null;
  if (/^(again|same|same folder)$/i.test(asked)) return prior;
  const extra = asked.match(/^(?:and|also)\s+(\S+)/i);
  if (!extra?.[1]) return null;
  if (/\bhave\b/i.test(prior)) return `do you have ${extra[1].replace(/[?.,]$/, "")}`;
  if (/\bfind\b/i.test(prior)) return `find ${extra[1].replace(/[?.,]$/, "")}`;
  if (/\bfiles in\b/i.test(prior)) return `files in ${extra[1].replace(/[?.,]$/, "")}`;
  if (/\bhow many files\b/i.test(prior)) return prior;
  return null;
}
