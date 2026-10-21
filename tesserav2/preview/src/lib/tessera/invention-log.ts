import { FED_VAULT } from "./fed-vault.ts";

/** Old invention cards. A stamp that says BUILT is not a device that was tested. */

export const INVENTION_CARDS = 1367;
export const INVENTION_CATEGORIES = 27;

export const INVENTION_HOLD =
  `The old log has ${INVENTION_CARDS} cards across ${INVENTION_CATEGORIES} labels, and ${FED_VAULT.length} sacred-knowledge lines now kept. Those sittings were real conversations. The secret engines they named now run: a title hashes to the same numbers, a tone is kept only when it is near, and a claim stays ungrounded unless it is an identity anchor. A card is still not a physical device.`;

export function fedVaultLine(query: string): string | null {
  const q = query.toLowerCase().replace(/-/g, " ");
  const hit = FED_VAULT.find((row) => q.includes(row.name.toLowerCase().replace(/-/g, " ")));
  return hit ? hit.said : null;
}

export function inventionAnswer(query: string): string | null {
  const fed = fedVaultLine(query);
  if (fed) return fed;
  if (/\binventions?\b|built card/i.test(query)) return INVENTION_HOLD;
  return null;
}
