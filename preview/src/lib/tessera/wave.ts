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
  { n: 27, text: "vowCheck still has to report every refusal, not only the first.", live: false },
  { n: 28, text: "Negation is still checked once for a whole note.", live: false },
  { n: 29, text: "The scoreboard does not yet run four named tests.", live: false },
  { n: 30, text: "A disagreeing test script is not yet shown beside the scoreboard.", live: false },
  { n: 31, text: "A merge note does not yet name the skipped CI steps.", live: false },
  { n: 32, text: "Typecheck does not yet name skipped packages.", live: false },
  { n: 33, text: "There is not yet a what-is-true-today file.", live: false },
  { n: 34, text: "A TESTED badge does not yet link to a test.", live: false },
  { n: 35, text: "The 100-question set is not written.", live: false },
  { n: 36, text: "No host is named for a larger model.", live: true },
  { n: 37, text: "A secret list must not contain values. None is stored here.", live: true },
  { n: 38, text: "The lane charter is not a separate page yet.", live: false },
  { n: 39, text: "The backup drill has not been run.", live: false },
  { n: 40, text: "The secret scan has not been run.", live: false },
  { n: 41, text: "Sealed blocks are not indexed to commits.", live: false },
  { n: 42, text: "The chat route has a length cap. It does not yet have a rate cap.", live: false },
  { n: 43, text: "Keyboard order for the whole page is not finished.", live: false },
  { n: 44, text: "A new-since-last-visit mark is not on conversations.", live: false },
  { n: 45, text: "Screen-reader names are not finished for every control.", live: false },
  { n: 46, text: "The world is not a second physical place.", live: true },
  { n: 47, text: "Agents on the map are labels, not people on the ground.", live: true },
  { n: 48, text: "Day and night follow Central time.", live: true },
  { n: 49, text: "This desk cannot train the weights.", live: true },
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
