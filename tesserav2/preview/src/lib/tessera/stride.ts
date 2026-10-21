import { combinedUse } from "./cycles.ts";

/** Eight checkouts already on disk. A note is not their source and not a running server. */
export const LOCAL_REPOS = [
  { name: "NeuroConscious", see: "Five steps ran after a wrapper set thirst.", context: "Their caller omits thirst.", meaning: "The run is theirs, edited by a wrapper, not by her.", build: "Keep the five-step note. Do not edit their files." },
  { name: "Brain-Cog", see: "The neuron file imports PyTorch.", context: "PyTorch is not installed.", meaning: "Their spike code did not run.", build: "Keep the compiled stand-in. Do not install their stack." },
  { name: "GodelOS", see: "The package imported.", context: "The server was not started.", meaning: "A read is not a consciousness claim.", build: "Do not start their server." },
  { name: "hyperon", see: "The compiled module is missing.", context: "The local pattern match is the replacement.", meaning: "A missing module stays missing.", build: "Do not download it." },
  { name: "HumanBrain", see: "The crates were not downloaded.", context: "A small compiled neuron stands in.", meaning: "Their simulator is not hers.", build: "Do not fetch the crates." },
  { name: "BrainSimII", see: "There is no .NET runtime.", context: "The local link step remains.", meaning: "The simulator did not run.", build: "Do not install a runtime." },
  { name: "blueprint", see: "The folder has notes and no program.", context: "A blueprint is not an engine.", meaning: "Nothing here can be started.", build: "Keep the title only. Do not start a program that is not there." },
  { name: "artificial-consciousness-ai", see: "The memory project asks for outside keys.", context: "No key was added.", meaning: "It was not started.", build: "Do not add a key." },
] as const;

export const SPONGE = [
  { name: "Fátima", see: "A public page is already kept.", context: "1917, three children, Cova da Iria.", meaning: "A kept page is recall, not a new apparition.", build: "Quote the kept sentence. Do not add to it." },
  { name: "sovereign", see: "She answers from the local note before any pen.", context: "Four outside tools stay: pen, github, web, drive.", meaning: "More local answers is the gain. The tool count does not fall by wishing.", build: "Prefer the stride. Leave the pen for what the stride does not hold." },
  { name: "stride", see: "Eight notes and the catalog line.", context: "A card is a pointer. A held name is not a skill.", meaning: "One recall can say all of them without a network call.", build: "Ask the stride first." },
  { name: "gap", see: "Names that are not on disk.", context: "272 catalog lines, eight folders.", meaning: "The other names were not reverse engineered.", build: "Leave them as pointers. Do not invent their source." },
] as const;

export type StrideNote = { name: string; see: string; context: string; meaning: string; build: string };

export function connect(note: StrideNote) {
  return `${note.name}. Saw: ${note.see} Context: ${note.context} Means: ${note.meaning} Next: ${note.build}`;
}

export function sovereignAnswer(query: string) {
  const q = query.toLowerCase();
  const note = [...LOCAL_REPOS, ...SPONGE].find((item) => q.includes(item.name.toLowerCase()));
  if (!note) return { local: false as const, text: "" };
  return { local: true as const, text: connect(note) };
}

/** All eight desk notes in one recall. No network. */
export function strideAll() {
  return LOCAL_REPOS.map(connect);
}

export type StrideCycle = {
  n: number;
  name: string;
  pass: boolean;
  localBefore: number;
  localAfter: number;
  external: number;
  share: number;
  line: string;
};

const EXTERNAL = 4;

export function runTwelve(): StrideCycle[] {
  const notes: StrideNote[] = [...LOCAL_REPOS, ...SPONGE];
  let local = 0;
  const rows: StrideCycle[] = [];
  for (let i = 0; i < notes.length; i += 1) {
    const note = notes[i];
    const line = connect(note);
    const again = sovereignAnswer(note.name);
    const card = i === 10 ? combinedUse("Panniantong/Agent-Reach") === "A card. Not installed." : true;
    const gap = i === 11 ? combinedUse("not-a-real/repo-xyz").includes("Do not invent") : true;
    const pass = again.local && again.text === line && line.includes("Next:") && card && gap && !/weight/i.test(line);
    const localBefore = local;
    if (pass) local += 1;
    const share = local / (local + EXTERNAL);
    rows.push({ n: i + 1, name: note.name, pass, localBefore, localAfter: local, external: EXTERNAL, share, line });
  }
  return rows;
}

export function twelveImproved(rows: StrideCycle[]) {
  return rows.length === 12 && rows.every((row) => row.pass) && rows[11].localAfter === 12 && rows[11].share > rows[0].share && rows[11].external === EXTERNAL;
}
