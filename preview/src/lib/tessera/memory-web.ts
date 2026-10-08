import { CATALOG, type CatalogHome, type CatalogRow } from "./catalog-pass.ts";

export const PASS_DATE = "2026-10-08";

export const HOME_LABEL: Record<CatalogHome, string> = {
  live: "Live home",
  gitbook: "Gitbook",
  vitality: "Vitality",
  card: "Card only",
  held: "Held out",
  tool: "Tool card",
  gap: "Gap",
  "not-a-repo": "Not a repository",
};

export const FLOWS = [
  {
    id: "drive",
    intake: "Google Drive",
    rule: "A file was cut at 45 MB. The Drive copy was removed only after TESSERA and Gitbook both had the same bytes.",
    home: "TESSERA and Gitbook. Both copies stay, because Drive itself was emptied.",
  },
  {
    id: "supply",
    intake: "Vitality-Supply 2.zip",
    rule: "Google asked for a sign-in. The bytes were not downloaded and were not invented.",
    home: "Still on Drive. Not deleted.",
  },
  {
    id: "store",
    intake: "Vitalitychems.com",
    rule: "The site checkout is collink1007/fleet-moss-monarch-rapid. 773 files that were missing from the vitality tree were added on 2026-10-08. It stays out of Tessera.",
    home: "vitalitychems-dot/vitality",
  },
  {
    id: "family",
    intake: "Old family GitHub repositories",
    rule: "Blob for blob, the files were already in a home. Exact duplicates were not copied again. collink1007 is still public. This login cannot delete that account.",
    home: "Gitbook and TESSERA for her archives. Vitality for the store.",
  },
  {
    id: "catalog",
    intake: "272 catalog names",
    rule: "Each name was resolved on 2026-10-08. Public code was not cloned. Trading code was not imported. Eight tool repositories were not installed.",
    home: "This web. A pointer is not a copy.",
  },
  {
    id: "log",
    intake: "tess/log-query.db",
    rule: "The Git LFS object 404s. A 420 MB database was not invented.",
    home: "Gap. Still missing.",
  },
] as const;

export const CHECKOUT_LESSON =
  "Eight research checkouts were already summarized, not recloned. NeuroConscious 64 files, Brain-Cog 721, GodelOS 929, hyperon-experimental 296, HumanBrain 159, BrainSimII 732, artificial-consciousness-blueprint 46, artificial-consciousness-ai 298. She may use the local pattern note. She may not start their servers, ask for an outside key, download HumanBrain's crates, or treat their consciousness claims as her own. Reading the notes does not change the model weights.";

export function countByHome() {
  const counts = {
    live: 0,
    gitbook: 0,
    vitality: 0,
    card: 0,
    held: 0,
    tool: 0,
    gap: 0,
    "not-a-repo": 0,
  } satisfies Record<CatalogHome, number>;
  let present = 0;
  let missing = 0;
  for (const row of CATALOG) {
    counts[row.home] += 1;
    if (row.state === "present") present += 1;
    else missing += 1;
  }
  return { total: CATALOG.length, present, missing, homes: counts };
}

export function filterCatalog(query: string, home: CatalogHome | "all") {
  const q = query.trim().toLowerCase();
  return CATALOG.filter((row) => {
    if (home !== "all" && row.home !== home) return false;
    if (!q) return true;
    return row.name.toLowerCase().includes(q) || row.note.toLowerCase().includes(q);
  });
}

export function lookupCatalog(name: string): CatalogRow | undefined {
  const q = name.trim().toLowerCase();
  return CATALOG.find((row) => row.name.toLowerCase() === q);
}

export function memoryWebText() {
  const c = countByHome();
  return [
    `Memory web ${PASS_DATE}. ${c.total} catalog names. ${c.present} repositories still exist. ${c.missing} names did not resolve.`,
    `${c.homes.card} public repositories were left as cards and were not cloned.`,
    `${c.homes.held} trading or chain repositories were not imported.`,
    `${c.homes.tool} tool repositories were not installed.`,
    `${c.homes.gitbook} old names already have a Gitbook archive.`,
    `${c.homes.vitality} store names belong in vitalitychems-dot/vitality.`,
    `${c.homes.gap} names are gaps. Nothing was invented for them.`,
    `${c.homes["not-a-repo"]} catalog lines were not repositories.`,
    "Drive sections remain in both TESSERA and Gitbook because the Drive copies were removed.",
    "Vitality-Supply 2.zip is still on Drive behind a sign-in wall.",
    "tess/log-query.db is still a missing 420 MB LFS object.",
    CHECKOUT_LESSON,
  ].join(" ");
}
