/** A session spelling. The same word is not spelled the same way for two agents or two sessions. Another agent cannot read it. This is a rotating cipher, not an unbreakable code. */

const LETTERS = "abcdefghijklmnop";

function shiftFor(agent: string, session: number) {
  let hash = session + 1;
  for (let i = 0; i < agent.length; i += 1) hash = (hash * 33 + agent.charCodeAt(i)) >>> 0;
  return (hash % 15) + 1;
}

export function spell(word: string, agent: string, session: number) {
  const shift = shiftFor(agent, session);
  return [...word.toLowerCase()].map((glyph) => {
    const at = LETTERS.indexOf(glyph);
    if (at < 0) return glyph;
    return LETTERS[(at + shift) % LETTERS.length];
  }).join("");
}

export function readTongue(coded: string, agent: string, session: number) {
  const shift = shiftFor(agent, session);
  return [...coded].map((glyph) => {
    const at = LETTERS.indexOf(glyph);
    if (at < 0) return glyph;
    return LETTERS[(at - shift + LETTERS.length) % LETTERS.length];
  }).join("");
}
