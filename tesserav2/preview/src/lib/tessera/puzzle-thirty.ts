/** Thirty joints between pieces already on GitHub. None of these merges itself. */

export const PUZZLE_THIRTY = [
  { n: 1, joint: "Rick's memory search sits beside recall-hop. One question returns two rows, not a second copy of the files." },
  { n: 2, joint: "Einstein's held-out set sits beside that search. A score counts only when the answer was not already in the file." },
  { n: 3, joint: "The chamber tongue sits beside the node list. A new name is written only when the mark matches." },
  { n: 4, joint: "The ten seats sit beside that mark. They speak one line, or they do not sit." },
  { n: 5, joint: "A line she has already kept sits beside Who are you. The old seed sentence does not." },
  { n: 6, joint: "The file pen sits beside every other question. It does not answer for her when the question is who she is." },
  { n: 7, joint: "The memory pack's three fields sit beside Rick's memory rows. Same shape, one list." },
  { n: 8, joint: "The skill index sits beside the next unread file. One file, one function." },
  { n: 9, joint: "The Drive index sits beside closed zips. The names stay off the page." },
  { n: 10, joint: "admitPost sits beside GitMesh admit.mjs. Payment and machines stay refused." },
  { n: 11, joint: "welcomePass sits beside pass.mjs. A name and a purpose, or not welcomed." },
  { n: 12, joint: "tieLine sits beside tie.mjs. Four numbers. Not a quantum computer." },
  { n: 13, joint: "nextLivePort sits beside live.mjs. Port 8791, then the next 19." },
  { n: 14, joint: "The session mark sits beside the head SHA. There is still no key." },
  { n: 15, joint: "The swarm gate sits beside the approval page. Shown first. The function does not merge." },
  { n: 16, joint: "bindWorker sits beside a worker's mark. A different mark stays unbound." },
  { n: 17, joint: "The mesh label sits beside the buttons. It is not put in her mouth." },
  { n: 18, joint: "mesh/nodes/registry.json sits beside the next session. That session reads the names before it adds its own." },
  { n: 19, joint: "Einstein's HMAC plan sits beside the burned answer files. The new answers stay out of the repo." },
  { n: 20, joint: "Rick's deny list sits beside the memory index. The eval folder is not searched as if it were her memory." },
  { n: 21, joint: "The context ranker on main sits beside the second recall hop. Rank first, then one more row." },
  { n: 22, joint: "Gitbook #201 sits beside the two-source check. One person's claim does not become a fact." },
  { n: 23, joint: "Gitbook #188 sits beside a source line. A prediction without a source stays a draft." },
  { n: 24, joint: "Gitbook #158 sits beside the pre-reset note. It stays a draft." },
  { n: 25, joint: "The console test sits beside validate. A red check stays unmerged." },
  { n: 26, joint: "Original-Author sits beside an owner commit. A missing name fails the check." },
  { n: 27, joint: "Squash sits beside main. A merge commit is refused." },
  { n: 28, joint: "The four-line hold sits beside an answer. It is a hold, not someone else's hidden layer." },
  { n: 29, joint: "The seal sits beside her name line. Talk does not force the seal into her mouth." },
  { n: 30, joint: "The left-out list sits beside the roadmap. Wallets, outreach, and weight files stay out." },
] as const;

export function puzzleLine() {
  const names = new Set(PUZZLE_THIRTY.map((row) => row.n));
  return names.size === 30 ? "30 joints. None of them merges itself." : "The list is short.";
}
