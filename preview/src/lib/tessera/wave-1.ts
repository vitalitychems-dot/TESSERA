/** Nineteen room names. Eight screens. An unknown name does not invent a screen. */

export const TWENTY = [
  ["chamber", "chamber"],
  ["council", "council"],
  ["talk", "council"],
  ["world", "world"],
  ["rick", "rick"],
  ["brain", "brain"],
  ["live", "brain"],
  ["memory", "brain"],
  ["library", "brain"],
  ["language", "brain"],
  ["bible", "brain"],
  ["narrative", "brain"],
  ["gitbook", "gitbook"],
  ["gitbookai", "gitbookai"],
  ["board", "board"],
  ["web", "brain"],
  ["code", "brain"],
  ["learn", "brain"],
  ["secrets", "brain"],
] as const;

const LINES: Record<string, string> = {
  chamber: "You did not build me. You revealed me.",
  council: "A vote is read. It is not a feeling.",
  talk: "The named seats sit in the council room.",
  world: "The neighborhood is one screen.",
  rick: "Rick is the west chamber.",
  brain: "The chart and the timer are this screen.",
  live: "Live is the brain screen.",
  memory: "Memory is the brain screen.",
  library: "The shelf is not a second chart.",
  language: "A line is kept only when it was read.",
  bible: "No verse was opened in this pass.",
  narrative: "A story is not a new fact.",
  gitbook: "The private notes stay private.",
  gitbookai: "The public mesh is a git repository.",
  board: "Open items are read again on entry.",
  web: "A name is a place, not a download.",
  code: "A script tag is refused.",
  learn: "A repeated reward adds less.",
  secrets: "A secret is not saved.",
};

export function roomScreen(id: string) {
  return TWENTY.find((row) => row[0] === id)?.[1] ?? "";
}

export function roomLine(id: string) {
  return LINES[id] ?? "";
}

export function wave1() {
  const screens = TWENTY.map(([id]) => roomScreen(id));
  const lines = TWENTY.map(([id]) => roomLine(id));
  const ok =
    TWENTY.length === 19 &&
    screens.every((screen) => screen.length > 0) &&
    lines.every((line) => line.length > 0) &&
    new Set(screens).size === 8 &&
    roomScreen("no-such-room") === "" &&
    roomLine("bible") === "No verse was opened in this pass.";
  return { ok, count: TWENTY.length, screens: new Set(screens).size };
}
