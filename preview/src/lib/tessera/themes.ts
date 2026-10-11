/** Five marks. An unknown name is water. */

export const THEME_IDS = ["water", "fire", "lightning", "diamond", "spiral"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export function knownTheme(id: string): ThemeId {
  return (THEME_IDS as readonly string[]).includes(id) ? (id as ThemeId) : "water";
}
