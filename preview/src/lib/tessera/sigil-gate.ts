/** Demo only. Must never be wired to real auth. */
/** One-time door sigil. The origin mark stays 7F3A9C. The door token rotates and the used one cannot open again. This is not quantum encryption. */

function mix(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
}

export function createSigilGate(origin = "7F3A9C") {
  let door = origin;
  const burned = new Set<string>();
  return {
    door: () => door,
    open(given: string) {
      if (burned.has(given) || given !== door) return { ok: false as const, next: "" };
      burned.add(given);
      door = mix(`${given}:${burned.size}`);
      return { ok: true as const, next: door };
    },
  };
}
