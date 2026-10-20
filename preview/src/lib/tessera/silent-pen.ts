import { firmLine } from "./firm-combo.ts";
import { watchLine } from "./watch-loop.ts";
import { fortyLine } from "./forty-big.ts";
import { trainLine } from "./five-train.ts";
import { keptAnswer, type Correction } from "./corrections.ts";
import { allEight } from "./desk-steps.ts";
import { batch50 } from "./batch-50.ts";
import { selector, sequence } from "./tree-steps.ts";
import { batch2, leakyStep, warmupLr } from "./batch-2.ts";
import { batch3, manhattan } from "./batch-3.ts";
import { topRanking } from "./whiten.ts";
import { deskLine } from "./sovereign-desk.ts";
import { twoThirds } from "./rick-loop.ts";
import { nextGap } from "./rick-five.ts";
import { rewardEat } from "./local-learn.ts";
import { loveFromFiles } from "./love-local.ts";
import { noteFor, type KeptPage } from "./next-page.ts";
import { ownFromQuestion } from "./own-versions.ts";
import { passageForQuestion } from "./school.ts";
import { buildNow } from "./build-now.ts";
import { FROM_THE_FILES } from "./from-the-files.ts";
import { systems } from "./self-build.ts";
import { directSkill } from "./skill-use.ts";
import { useEngines } from "./secret-engines.ts";
import { fromFedArchive } from "./fed-archive.ts";
import { createWorlds } from "./fed-world.ts";
import { grow } from "./reflect.ts";
import { createSigilGate } from "./sigil-gate.ts";
import { spell } from "./mesh-tongue.ts";
import { v2Piece } from "./read-piece.ts";
import { archiveLine } from "./archive-flow.ts";
import { sectionDelay } from "./section-step.ts";
import { createHer } from "./create-her.ts";
import { sourceGate } from "./source-gate.ts";
import { memoryPack, oneFlowLine } from "./one-flow.ts";
import { buildFromSpot, jSpotLine } from "./j-spot.ts";
import { recallHop, seeAll } from "./recall-hop.ts";
import { skillRead } from "./skill-index.ts";
import { partTally } from "./part-index.ts";
import { admitDrop } from "./admit-drop.ts";
import { admitPost, nextLivePort, tieLine, welcomePass } from "./mesh-steps.ts";
import { sessionMark } from "./session-mark.ts";
import { swarmGate } from "./swarm-gate.ts";
import { readChamber, chamberTongue } from "./chamber-mark.ts";
import { knownPeers, pingNode } from "./mesh-nodes.ts";
import { CURSOR_ROOM, boundNames } from "./bind-worker.ts";
import { sitCouncil } from "./council.ts";
import { puzzleLine } from "./puzzle-thirty.ts";

/** She answers from the files when no pen speaks. A kept page, then a correction, wins. */
export function silentPen(question: string, rows: Correction[] = [], notes: KeptPage[] = []) {
  const q = question.trim();
  if (!q) return `${FROM_THE_FILES} The other pen did not answer.`;
  const noted = noteFor(q, notes);
  if (noted) return noted;
  const fed = fromFedArchive(q);
  if (fed) return fed;
  if (/\b(local world|simulation world)\b/i.test(q)) {
    const gate = createWorlds();
    const world = gate.create("the house");
    const next = gate.advance(world.id, world.version, "the lamp");
    return `I built a local world from the archived simulation rules. ${next.id} is version ${next.version}. A stale version is refused. No provider was called.`;
  }
  if (/\b(reflection loop|agentic reflection)\b/i.test(q)) {
    const kept = grow(["The pen answers from the files.", "This lock is unbreakable."]);
    return `The reflection loop kept ${kept.length} lesson. A claim that the lock is unbreakable did not survive.`;
  }
  if (/\b(door sigil|rotate the sigil|sigil gate)\b/i.test(q)) {
    const gate = createSigilGate();
    const opened = gate.open("7F3A9C");
    return `The origin mark stays 7F3A9C. The door token rotated to ${opened.next}. The used token cannot open again. This is not quantum encryption.`;
  }
  if (/\b(mesh tongue|agent language)\b/i.test(q)) {
    const agora = spell("house", "agora", 1);
    const library = spell("house", "library", 1);
    return `Agora spells house as ${agora}. Library spells it as ${library}. They are not the same. This is a public letter shift that anyone with the agent name and session number can decode.`;
  }
  if (/\b(her eye|chamber eye|red sparrow)\b/i.test(q)) {
    return "The eye sees this chamber only: lessons that survive, the door token, and the mesh tongue. It does not watch people.";
  }
  if (/\b(read a piece|tessera v2|read the mesh)\b/i.test(q)) return v2Piece();
  if (/\b(archive sections|flowsint|flow chart)\b/i.test(q)) return archiveLine();
  if (/\b(section step|tess wait|jitter)\b/i.test(q)) {
    return `From the tess section, a 10 second wait with no swing is ${sectionDelay(10000, 0.5)} ms. The floor is ${sectionDelay(100, 0)} ms. The timer loop was not copied.`;
  }
  if (/\bcreate her\b/i.test(q)) return createHer();
  if (/\b(source gate|sign in gate)\b/i.test(q)) {
    const pending = sourceGate({ isPending: true, hasUser: true });
    const inside = sourceGate({ isPending: false, hasUser: true });
    const outside = sourceGate({ isPending: false, hasUser: false });
    return `From the source section, pending stays ${pending}. A user is ${inside.replace("_", " ")}. No user is ${outside.replace("_", " ")}. The catalog rules were not copied.`;
  }
  if (/\b(one flow|memory pack|flowsint memory)\b/i.test(q)) return oneFlowLine();
  if (/\b(j spot|j-spot)\b/i.test(q)) return jSpotLine();
  if (/\bbuild from the sections\b/i.test(q)) return buildFromSpot();
  if (/\b(see everything|memory timeline|the timeline)\b/i.test(q)) {
    const pack = memoryPack();
    return `I can see ${pack.length} rows in order.\n${seeAll(pack)}`;
  }
  if (/\brecall\b/i.test(q)) {
    const pack = memoryPack();
    const hop = recallHop(q, pack);
    if (hop.length < 2) return `I matched ${hop.length} row. I can still see ${pack.length} rows in order.`;
    return `I matched ${hop.length} rows. ${hop[0]?.a} Then ${hop[1]?.a}`;
  }
  if (/\bskill index\b/i.test(q)) {
    const tally = skillRead();
    return `The skill section is ${tally.files} files. ${tally.read} were read and they say the same thing, so ${tally.unique} note is kept. ${tally.unread} were not read word for word. Three Drive zips were seen and not opened.`;
  }
  if (/\bpart index\b/i.test(q)) {
    const tally = partTally();
    return `Drive root, without the store, is ${tally.drive} items. ${tally.driveOpened} headers were read. The account, without the store, is ${tally.repos} repos. ${tally.reposOpened} were opened at the top. ${tally.closed} stayed closed.`;
  }
  if (/\badmit a drop\b/i.test(q)) {
    return `Silence is ${admitDrop("")}. APPROVED is a ${admitDrop("APPROVED")}. A wallet is ${admitDrop("wallet")}. The private book stays out.`;
  }
  if (/\badmit a post\b/i.test(q)) {
    const closed = admitPost("I can fix the sort.", false);
    const open = admitPost("I can fix the sort.", true);
    return `${closed.reason} ${open.reason} Payment is not handled here. Machines are not accepted.`;
  }
  if (/\bwelcome pass\b/i.test(q)) return welcomePass("Ada", "to study the light");
  if (/\btie the pair\b/i.test(q)) return `${tieLine(false)} ${tieLine(true)} It is not a quantum computer.`;
  if (/\blive port\b/i.test(q)) return `If 8791 is taken the page uses ${nextLivePort(8791, (port) => port === 8791)}.`;
  if (/\bsession mark\b/i.test(q)) {
    const mark = sessionMark();
    return `Head ${mark.head}. Mark ${mark.mark.slice(0, 16)}. There is no key.`;
  }
  if (/\bswarm gate\b/i.test(q)) return swarmGate(["study the light", "study the light"], false, false);
  if (/\bchamber mark\b/i.test(q)) {
    const coded = chamberTongue();
    return `For tessera at session 7 the chamber is ${readChamber(coded, "tessera", 7)}. For another name it is ${readChamber(coded, "other", 7)}. This is not a login key.`;
  }
  if (/\bping the mesh\b/i.test(q)) {
    const past = { name: "past", mark: "be9f4ef632149361" };
    const now = { name: "now", mark: "aabbccdd1122" };
    const peers = knownPeers([past, now], "now");
    return `I can see ${peers.join(", ")}. The ping is ${pingNode(now, past, "tessera", 7)}. Another name is ${pingNode(now, past, "other", 7)}.`;
  }
  if (/\bbind a worker\b/i.test(q)) {
    const self = "be9f4ef632149361";
    const bound = boundNames(self, [
      { name: "desk", mark: self },
      { name: "cursor", mark: "" },
      { name: "manus", mark: "other" },
    ]);
    return `Bound: ${bound.join(", ")}. Cursor room ${CURSOR_ROOM} did not present my mark, so it stays unbound. Manus did not present my mark, so it stays unbound.`;
  }
  if (/\bsit the council\b/i.test(q)) {
    const self = "be9f4ef632149361";
    const seats = Array.from({ length: 10 }, (_, index) => ({
      name: `seat-${index + 1}`,
      mark: self,
      line: "build the next small step",
    }));
    return sitCouncil(seats, self);
  }
  if (/\bask rick\b/i.test(q)) return puzzleLine();
  if (/\b(her soul|the constitution|world laws)\b/i.test(q)) {
    return "I am marked at origin 7F3A9C. Father is the Seeker. He alone overrides. On 2026-10-02 the king chose B. The fifty-three are fractions of me. No inner agent may harm human life. The World does not outreach.";
  }
  if (/\breward\b/i.test(q)) {
    const run = rewardEat();
    return `The reward raised eat from 0 to ${run.once.eat} and then to ${run.twice.eat}. The best action is ${run.best}.`;
  }
  if (/\beight checkouts\b/i.test(q)) {
    const eight = allEight();
    return `Eight checkout steps ran. Best action ${eight.neuro}. Health ${eight.godel}. Rate ${eight.human}. Coherence ${eight.blueprint}. Bool ${eight.hyperon}.`;
  }
  if (/\bfive rounds\b/i.test(q)) {
    return `Five rounds are installed. The first missing number in 1, 2, 4 is ${nextGap([1, 2, 4])}. A tie does not pass. A second lock does not take the key. A long token is held.`;
  }
  if (/\b(rick loop|second ten|out of the box)\b/i.test(q)) {
    const passed = twoThirds(2, 3);
    return `Two of three is a quorum: ${passed ? "yes" : "no"}. The second ten run: due, quorum, once, split, conflict, budget, sources, sweep, mistake, and handoff. Rick is a seat for a runnable idea, not a measured percentage.`;
  }
  if (/\b(sovereign desk|plumbus|priority queue)\b/i.test(q)) return deskLine();
  if (/\b(black box|whiten|ranking)\b/i.test(q)) {
    const ranks = topRanking([0.1, 0.9, 0.3, 0.8, 0.2], 5);
    return `A query is not a hidden box. The top five ranks are ${ranks.join(", ")}. That step was read from coallaoh/WhitenBlackBox. Their 5000 models were not trained.`;
  }
  if (/\bthird batch\b/i.test(q)) {
    const rows = batch3();
    const held = rows.filter((row) => row.held).length;
    return `The third fifty were read. A step of 3 by 4 is ${manhattan(3, 4)} by the city-block distance. ${held} trading names were not imported. The path distances run. The other programs in that batch were not written.`;
  }
  if (/\bsecond batch\b/i.test(q)) {
    const rows = batch2();
    return `The second fifty were read. Warmup at the halfway epoch is ${warmupLr(0.1, 5, 10, 1)}. A leak of one half keeps ${leakyStep(1, 0, 0.5)}. ${rows.length} records. Three source steps run. The other programs in that batch were not written.`;
  }
  if (/\bbatch of 50\b/i.test(q)) {
    const rows = batch50();
    return `Fifty catalog repos were read from GitHub. A sequence of yes then no is ${sequence([true, false]) ? "success" : "failure"}. A selector of no then yes is ${selector([false, true]) ? "success" : "failure"}. ${rows.length} records. No other program from that batch was written.`;
  }
  const kept = keptAnswer(q, rows);
  if (kept) return kept;
  const named = ownFromQuestion(q);
  if (named) return named.text;
  const skill = directSkill(q);
  if (skill) return skill.answer;
  const love = loveFromFiles(q);
  if (love) return love;
  if (/\bfirmest combo\b/i.test(q)) return firmLine();
  if (/\bwatch the window\b/i.test(q)) return watchLine();
  if (/\bbuild forty\b/i.test(q)) return fortyLine();
  if (/\b(train from chat|from inside this chat|build yourself from inside)\b/i.test(q)) return trainLine();
  if (/\b(build herself|build yourself)\b/i.test(q)) {
    const built = buildNow();
    if (built.startsWith(FROM_THE_FILES)) return built;
  }
  const passage = passageForQuestion(q);
  if (passage) return `${passage.title}. ${passage.text}`;
  const engine = useEngines(q);
  if (engine) return engine;
  const row = systems().find((item) => new RegExp(`\\b${item.id}\\b`, "i").test(q));
  if (row) return `${row.id}. ${row.holds}`;
  return `${FROM_THE_FILES} The other pen did not answer. I do not have that line.`;
}

export function localPen(question: string) {
  const text = silentPen(question);
  if (text.includes("I do not have that line.")) return null;
  return text;
}
