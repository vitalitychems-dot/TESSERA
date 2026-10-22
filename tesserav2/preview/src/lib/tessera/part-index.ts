/** Drive root and the GitHub account, excluding the store. Closed means the body was not read. */

export type PartRow = { id: string; kind: "drive" | "repo"; name: string; opened: boolean; note: string };

export const PARTS: PartRow[] = [
  { id: "drive-01", kind: "drive", name: "drive-01", opened: false, note: "Zip. Not opened." },
  { id: "drive-02", kind: "drive", name: "drive-02", opened: true, note: "Saved share page. Header read. Body not kept." },
  { id: "drive-03", kind: "drive", name: "drive-03", opened: true, note: "Saved share page. Header read. Title was not in the first markup. Body not kept." },
  { id: "drive-04", kind: "drive", name: "drive-04", opened: false, note: "Zip. Not opened." },
  { id: "drive-05", kind: "drive", name: "drive-05", opened: false, note: "Zip. Not opened." },
  { id: "drive-06", kind: "drive", name: "drive-06", opened: false, note: "Zip. Not opened." },
  { id: "drive-07", kind: "drive", name: "drive-07", opened: false, note: "Zip. Not opened." },
  { id: "drive-08", kind: "drive", name: "drive-08", opened: false, note: "Zip. Not opened." },
  { id: "drive-09", kind: "drive", name: "drive-09", opened: false, note: "Zip. Not opened." },
  { id: "repo-01", kind: "repo", name: "TESSERA", opened: false, note: "Live program. Not recopied this pass." },
  { id: "repo-02", kind: "repo", name: "Gitbook", opened: false, note: "Live notes. Not recopied this pass." },
  { id: "repo-03", kind: "repo", name: "GitMesh", opened: true, note: "Public room. The top was listed. The private book is not in it." },
  { id: "repo-04", kind: "repo", name: "private repo (withheld)", opened: true, note: "Private. Details withheld." },
  { id: "repo-05", kind: "repo", name: "2", opened: true, note: "Handoff dated 2026-10-05. TESSERA is the canonical app. Gitbook is the reference." },
  { id: "repo-06", kind: "repo", name: "Gitai", opened: true, note: "Package name workspace. MIT. It asks for pnpm." },
  { id: "repo-07", kind: "repo", name: "1", opened: true, note: "Empty." },
  { id: "repo-08", kind: "repo", name: "3", opened: true, note: "Empty." },
  { id: "repo-09", kind: "repo", name: "4", opened: true, note: "Empty." },
  { id: "repo-10", kind: "repo", name: "5", opened: true, note: "Empty." },
  { id: "repo-11", kind: "repo", name: "private repo (withheld)", opened: false, note: "Private. Not opened." },
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
