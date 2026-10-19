/** Drive root and the GitHub account, excluding the store. Closed means the body was not read. */

export type PartRow = { id: string; kind: "drive" | "repo"; name: string; bytes: number; opened: boolean; note: string };

export const PARTS: PartRow[] = [
  { id: "drive-01", kind: "drive", name: "8 2.zip", bytes: 359996696, opened: false, note: "Zip. Not opened." },
  { id: "drive-02", kind: "drive", name: "share-2c60cde7", bytes: 563875, opened: true, note: "Saved share page titled Tessera's Sovereign AGI Integration. Header read. Body not kept." },
  { id: "drive-03", kind: "drive", name: "share-3ad6b7d8", bytes: 777152, opened: true, note: "Saved share page. Header read. Title was not in the first markup. Body not kept." },
  { id: "drive-04", kind: "drive", name: "Tesseract-AI 5.zip", bytes: 419604215, opened: false, note: "Zip. Not opened." },
  { id: "drive-05", kind: "drive", name: "tesseract_consolidated.zip", bytes: 93635859, opened: false, note: "Zip. Not opened." },
  { id: "drive-06", kind: "drive", name: "Tesseracxt9.zip", bytes: 659619726, opened: false, note: "Zip. Not opened." },
  { id: "drive-07", kind: "drive", name: "Tx13.zip", bytes: 380918944, opened: false, note: "Zip. Not opened." },
  { id: "drive-08", kind: "drive", name: "Tx17 9.zip", bytes: 428310650, opened: false, note: "Zip. Not opened." },
  { id: "drive-09", kind: "drive", name: "XL1.zip", bytes: 3053350884, opened: false, note: "Zip. Not opened." },
  { id: "repo-01", kind: "repo", name: "TESSERA", bytes: 0, opened: false, note: "Live program. Not recopied this pass." },
  { id: "repo-02", kind: "repo", name: "Gitbook", bytes: 0, opened: false, note: "Live notes. Not recopied this pass." },
  { id: "repo-03", kind: "repo", name: "GitMesh", bytes: 0, opened: true, note: "Public room. The top was listed. The private book is not in it." },
  { id: "repo-04", kind: "repo", name: "combined", bytes: 0, opened: true, note: "The 12 GB archive is release assets, not repository blobs." },
  { id: "repo-05", kind: "repo", name: "2", bytes: 0, opened: true, note: "Handoff dated 2026-10-05. TESSERA is the canonical app. Gitbook is the reference. A secret name in that file was not copied." },
  { id: "repo-06", kind: "repo", name: "Gitai", bytes: 0, opened: true, note: "Package name workspace. MIT. It asks for pnpm." },
  { id: "repo-07", kind: "repo", name: "1", bytes: 0, opened: true, note: "Empty." },
  { id: "repo-08", kind: "repo", name: "3", bytes: 0, opened: true, note: "Empty." },
  { id: "repo-09", kind: "repo", name: "4", bytes: 0, opened: true, note: "Empty." },
  { id: "repo-10", kind: "repo", name: "5", bytes: 0, opened: true, note: "Empty." },
  { id: "repo-11", kind: "repo", name: "box-backup-2026-10-13", bytes: 0, opened: false, note: "Private. Not opened." },
];

export function partTally() {
  const drive = PARTS.filter((row) => row.kind === "drive");
  const repos = PARTS.filter((row) => row.kind === "repo");
  return {
    drive: drive.length,
    driveOpened: drive.filter((row) => row.opened).length,
    repos: repos.length,
    reposOpened: repos.filter((row) => row.opened).length,
    closed: PARTS.filter((row) => !row.opened).length,
  };
}
