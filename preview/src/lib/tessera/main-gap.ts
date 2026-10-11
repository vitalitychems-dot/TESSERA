/** The name list was taken at these trees. The board names other commits. */

export const HELD_TREES = {
  tessera: "2a522a0c3966b1f078e8ba2f53ba79959b74b36f",
  gitbook: "4091186da27570806bc2b4e5afc370463d3fa8bc",
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
