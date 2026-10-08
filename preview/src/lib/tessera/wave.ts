export const NOTE_CAP = 4000;

export type WaveItem = { n: number; text: string; live: boolean };

export const WAVE: WaveItem[] = [
  { n: 1, text: "Issue 4 is the only board.", live: true },
  { n: 2, text: "Yes or no posts only when a question is open.", live: true },
  { n: 3, text: "The lane is read from the comment, not the login.", live: true },
  { n: 4, text: "Nothing is ticked without a test that was run.", live: true },
  { n: 5, text: "A repeated first line is not posted again.", live: true },
  { n: 6, text: "The pen line names the model that answered.", live: true },
  { n: 7, text: "A bare yes is not sent to the model as a new task.", live: true },
  { n: 8, text: "The map is labeled a picture.", live: true },
  { n: 9, text: "The last tab survives a refresh.", live: true },
  { n: 10, text: "The Board says who it is waiting on.", live: true },
  { n: 11, text: "A check time appears only after a check.", live: true },
  { n: 12, text: "GitHub links open outside the page.", live: true },
  { n: 13, text: "The places are a row of real pages. There is no More menu and no cycle button.", live: true },
  { n: 14, text: "A note over 4000 characters is refused and kept.", live: true },
  { n: 15, text: "A failed send can be retried without retyping.", live: true },
  { n: 16, text: "A relay is marked and does not count as that lane's own post.", live: true },
  { n: 17, text: "The map pace can be slower, quiet, or faster.", live: true },
  { n: 18, text: "One pen-health line is kept per day, with no message text.", live: true },
  { n: 19, text: "The local model is named as a test, not as her training.", live: true },
  { n: 20, text: "Closed files stay closed.", live: true },
  { n: 21, text: "No crypto, wallet, trading, or store work is in this wave.", live: true },
  { n: 22, text: "A merge is not started from this page.", live: true },
  { n: 23, text: "Search, the palette, and drafts wait for Father's own pass.", live: false },
  { n: 24, text: "Pin, archive, and empty states wait for that same pass.", live: false },
  { n: 25, text: "A login wall is not added.", live: true },
  { n: 26, text: "The web-reader flag stays off.", live: true },
  { n: 27, text: "vowCheck reports every refusal in the note, not only the first.", live: true },
  { n: 28, text: "A negated claim is not refused.", live: true },
  { n: 29, text: "The scoreboard runs four named tests.", live: true },
  { n: 30, text: "A disagreeing claim is shown beside the scoreboard and fails.", live: true },
  { n: 31, text: "The merge note names the skipped CI steps.", live: true },
  { n: 32, text: "Typecheck names what it skips: node_modules, and scripts src does not import.", live: true },
  { n: 33, text: "What is true today is written on the board.", live: true },
  { n: 34, text: "A TESTED line links to its test file.", live: true },
  { n: 35, text: "The 100-question set is written. One step still stops at the cap.", live: true },
  { n: 36, text: "No host is named for a larger model.", live: true },
  { n: 37, text: "A secret list must not contain values. None is stored here.", live: true },
  { n: 38, text: "The lane charter is on the board.", live: true },
  { n: 39, text: "The backup drill found the school notes and the catalog.", live: true },
  { n: 40, text: "The secret scan has been run. It returns paths only.", live: true },
  { n: 41, text: "Sealed blocks are not indexed to commits.", live: false },
  { n: 42, text: "The chat pen allows 12 replies an hour.", live: true },
  { n: 43, text: "Keyboard order for the whole page is not finished.", live: false },
  { n: 44, text: "A new-since-last-visit mark is not on conversations.", live: false },
  { n: 45, text: "Screen-reader names are not finished for every control.", live: false },
  { n: 46, text: "The world is not a second physical place.", live: true },
  { n: 47, text: "Agents on the map are labels, not people on the ground.", live: true },
  { n: 48, text: "Day and night follow Central time.", live: true },
  { n: 49, text: "This desk does not train a model.", live: true },
  { n: 50, text: "AGI is a goal, not a fact on this page.", live: true },
];

export function clipNote(text: string) {
  const note = text.trim();
  if (note.length <= NOTE_CAP) return { ok: true as const, text: note };
  return { ok: false as const, error: `That note is ${note.length} characters. Keep it under ${NOTE_CAP}. It was not sent.` };
}

export function isRelay(body: string) {
  return /\brelay(?:ed| of)?\b/i.test(body);
}

export function paceMs(word: string) {
  const said = word.toLowerCase();
  if (said === "slower") return 2400;
  if (said === "quiet") return 0;
  if (said === "faster") return 600;
  return 1200;
}

export function healthLine(vendor: string, model: string, day: string) {
  return `${day} ${vendor} ${model} health ok`;
}

export function waveCount() {
  const live = WAVE.filter((item) => item.live).length;
  return { live, goal: WAVE.length - live, total: WAVE.length };
}
