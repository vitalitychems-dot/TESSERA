/** One piece at a time. Store lines are dropped before a lesson is kept. */

const STORE = /vitality|peptide|checkout|product[- ]image|vial|storefront|stripe|retatrutide|bpc-?157|tirzepatide/i;

export const PIECES = [
  {
    repo: "GitMesh",
    sha: "470219b795",
    text: "The mesh is this repository. Clone it and read it with no web. The private Gitbook is not in here.",
  },
  {
    repo: "Gitbook",
    sha: "66d19d45ea",
    text: "The reflection loop keeps a plain lesson. A claim that a lock is unbreakable is dropped.",
  },
  {
    repo: "combined",
    sha: "b33c495ee4",
    text: "The archive is a release asset. A repository does not run a server by being read.",
  },
  {
    repo: "TESSERA",
    sha: "04588bfeb0",
    text: "The door token rotates. The used token cannot open again.\nProduct images of vials and a peptide catalog stay out.",
  },
] as const;

export function readPiece(text: string) {
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const kept: string[] = [];
  let dropped = 0;
  for (const line of lines) {
    if (STORE.test(line)) dropped += 1;
    else kept.push(line.slice(0, 180));
  }
  return { kept, dropped };
}

export function v2Piece() {
  const read = PIECES.map((piece) => {
    const row = readPiece(piece.text);
    const line = row.kept[0] ?? "Nothing in this piece survived.";
    return `${piece.repo} ${piece.sha}: ${line} Dropped ${row.dropped}.`;
  });
  return `I read four pieces. ${read.join(" ")} Store lines were not kept.`;
}
