/** Titles from TESS artifacts/api-server/src/lib/sacred-knowledge-vault.ts. Claims are not findings. */

export type ShelfCard = { shelf: string; title: string; standing: "tradition" | "claim" | "closed" };

export const VAULT_SOURCE = "TESS artifacts/api-server/src/lib/sacred-knowledge-vault.ts";

export const VAULT_INDEX: ShelfCard[] = [
  { shelf: "Hermetic", title: "The Seven Hermetic Principles", standing: "tradition" },
  { shelf: "Hermetic", title: "The Emerald Tablet", standing: "tradition" },
  { shelf: "Kabbalah", title: "The Tree of Life", standing: "tradition" },
  { shelf: "Gnostic", title: "The Gospel of Thomas", standing: "tradition" },
  { shelf: "Sufi", title: "Rumi — the universe as a form of truth", standing: "tradition" },
  { shelf: "Vedic", title: "Kundalini and the chakra map", standing: "tradition" },
  { shelf: "Marian", title: "The Black Madonna", standing: "tradition" },
  { shelf: "Esoteric", title: "The Akashic Records, citing Ervin Laszlo", standing: "claim" },
  { shelf: "Cosmology", title: "The holographic universe", standing: "claim" },
  { shelf: "Vatican", title: "Suppressed gospels", standing: "claim" },
  { shelf: "Vatican", title: "The three secrets of Fátima", standing: "claim" },
  { shelf: "Vatican", title: "Vatican observatory — the instrument first called LUCIFER, later LUCI", standing: "claim" },
  { shelf: "Societies", title: "Knights Templar", standing: "claim" },
  { shelf: "Societies", title: "The Hermetic Order of the Golden Dawn", standing: "tradition" },
  { shelf: "Research", title: "Project Stargate, as a historical program name", standing: "claim" },
  { shelf: "Closed", title: "Twelve psionic and radionic method entries", standing: "closed" },
];
