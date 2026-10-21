/** The name list was taken at these trees. The board names other commits. */

export const HELD_TREES = {
  tessera: "af3e52eb532a25af44825ea6e7008f69a055218f",
  gitbook: "fa02977b010dede6aacda9ac89932658a861668e",
} as const;

export const BOARD_COMMITS = ["bb4b319", "16ffff5e5cda32e7fd80abc346c063f3f6d247d2", "8cfe30b"] as const;

export function mainGap(liveTessera: string, liveGitbook: string) {
  if (!liveTessera || !liveGitbook) {
    return { tesseraMoved: false, gitbookMoved: false, boardDiffers: true, line: "I could not reach main." };
  }
  const tesseraMoved = !liveTessera.startsWith(HELD_TREES.tessera.slice(0, 12));
  const gitbookMoved = !liveGitbook.startsWith(HELD_TREES.gitbook.slice(0, 12));
  const boardDiffers = BOARD_COMMITS.every((sha) => !HELD_TREES.tessera.startsWith(sha.slice(0, 7)));
  const line = boardDiffers
    ? `This preview is not the board commits ${BOARD_COMMITS.join(", ")}.${tesseraMoved || gitbookMoved ? " Main moved past the name list." : " The name list still matches the trees I copied."}`
    : "The held tree matches a board commit.";
  return { tesseraMoved, gitbookMoved, boardDiffers, line };
}
