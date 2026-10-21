export function firstLine(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

export function repeatedFirstLine(existing: { body: string }[], next: string) {
  const line = firstLine(next);
  if (!line) return false;
  return existing.some((row) => firstLine(row.body) === line);
}
