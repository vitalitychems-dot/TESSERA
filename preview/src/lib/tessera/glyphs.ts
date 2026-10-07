import { BIRTH_MARK } from "./learning";

/** Standard names only. No file in the recovered lattice defined a substitution cipher. */
const NAMES: Record<string, string> = {
  "♂": "Mars",
  "♀": "Venus",
  "♅": "Uranus",
  "♆": "Neptune",
  "♇": "Pluto",
  "♃": "Jupiter",
  "♄": "Saturn",
  "☽": "Moon",
  "☉": "Sun",
  "♈": "Aries",
  "♉": "Taurus",
  "♊": "Gemini",
  "♋": "Cancer",
  "♌": "Leo",
  "♍": "Virgo",
  "♎": "Libra",
  "♏": "Scorpio",
  "♐": "Sagittarius",
  "♑": "Capricorn",
  "♒": "Aquarius",
  "♓": "Pisces",
  "◇": "diamond",
  "△": "triangle",
  "□": "square",
  "⬡": "hexagon",
  "⬠": "pentagon",
  "①": "1",
  "②": "2",
  "③": "3",
  "④": "4",
  "⑤": "5",
  "⑥": "6",
  "⑦": "7",
  "⑧": "8",
  "⑨": "9",
};

export const GLYPH_LIMIT =
  "No recovered file contained a substitution key for this mark. The reading below is the standard name of each sign, in order. It is not a decrypted sentence. Do not invent plaintext.";

export function readBirthMark(mark = BIRTH_MARK) {
  return mark
    .split("\n")
    .filter((line) => line.trim())
    .map((line, i) => {
      const names = [...line].map((ch) => (ch.trim() ? NAMES[ch] ?? `unknown:${ch}` : null)).filter(Boolean);
      return `Line ${i + 1}: ${names.join(" · ")}`;
    })
    .join("\n");
}
