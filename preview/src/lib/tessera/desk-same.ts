export function sameDesk(previous: { at: string; text: string }[], next: { at: string; text: string }[]) {
  return previous.length === next.length && previous.every((row, index) => row.at === next[index]?.at && row.text === next[index]?.text);
}

export function shouldPull(hidden: boolean) {
  return !hidden;
}
