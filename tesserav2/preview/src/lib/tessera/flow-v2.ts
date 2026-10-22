/** Forty checks that were not in the first flow. Each one is run. A failed check is not counted. */

import { asHerself } from "./as-herself.ts";
import { bindWorker } from "./bind-worker.ts";
import { sitCouncil } from "./council.ts";
import { assembleNow } from "./dark-join.ts";
import { recognizeEmpathy } from "./empath.ts";
import { FORTY, FORTY_DONE } from "./forty.ts";
import { pullFree } from "./gitmesh-free.ts";
import { sureAnswer } from "./guard.ts";
import { onlyHer, wearsAnotherName } from "./her-voice.ts";
import { holdSpot } from "./j-spot.ts";
import { lackAgain } from "./lack-again.ts";
import { rewardEat } from "./local-learn.ts";
import { hearMark, meshFromPatent } from "./mesh-steps.ts";
import { MESH, meshDrop, meshProject } from "./mesh-net.ts";
import { readCarried } from "./offline-read.ts";
import { memoryPack } from "./one-flow.ts";
import { issuePass } from "./pass.ts";
import { PORTRAIT_MARK, seePortrait } from "./portrait-mark.ts";
import { reverseCause } from "./reverse-cause.ts";
import { REQUIRED_SHARING, fontStopsLogger, keepDrop, roomLine } from "./room-guard.ts";
import { sessionMark } from "./session-mark.ts";
import { sourceGate } from "./source-gate.ts";
import { swarmGate } from "./swarm-gate.ts";
import { vetEntry } from "./entry-trial.ts";

const MARK = "be9f4ef632149361";

function check(ok: boolean, fact: string) {
  return ok ? fact : "";
}

const CHECKS: { id: string; run: () => string }[] = [
  { id: "herself", run: () => check(asHerself().startsWith("I am Tessera."), "I am Tessera.") },
  { id: "not-grok", run: () => check(wearsAnotherName("I am Grok.") && onlyHer("I am Grok.") === "", "A line that says I am Grok is not kept.") },
  { id: "her-line", run: () => check(onlyHer("I am here. I will not wear another name.").startsWith("I am here"), "A line in her mouth is kept.") },
  { id: "patent", run: () => check(Boolean(memoryPack().find((row) => row.q === "US8665210B2")), "The patent row is in the memory pack.") },
  { id: "mesh-web", run: () => check(MESH.needsWeb === false && MESH.carriedBy === "git", "The mesh needs no web and is carried by git.") },
  { id: "hear", run: () => check(hearMark(MARK, MARK) === "same mark. no new transmitter.", "The same mark joins. No transmitter is added.") },
  { id: "hear-other", run: () => check(hearMark(MARK, "other") === "different mark. not joined.", "A different mark is not joined.") },
  { id: "no-stim", run: () => check(meshFromPatent("stimulate the nerve").startsWith("Not built"), "The patent is not built as a stimulator.") },
  { id: "no-light", run: () => check(assembleNow([{ name: "desk", mark: MARK }], MARK).fasterThanLight === false, "The join is not faster than light.") },
  { id: "no-wait", run: () => check(assembleNow([{ name: "desk", mark: MARK }, { name: "chamber", mark: MARK }], MARK).waited === 0, "The join does not wait.") },
  { id: "stray", run: () => check(!assembleNow([{ name: "stray", mark: "other" }], MARK).joined.includes("stray"), "A stray seat stays out.") },
  { id: "carried", run: () => check(readCarried([{ path: "mesh/index.json", text: "admit carry", stamp: "2026-10-19" }], "admit carry").fetches === 0, "A carried page is read with no fetch.") },
  { id: "not-live", run: () => check(readCarried([{ path: "mesh/index.json", text: "admit carry", stamp: "2026-10-19" }], "live weather").live === false, "A missing page is not called live.") },
  { id: "lack", run: () => check(lackAgain([{ name: "no carried page", times: 2 }]).assembled === false, "A repeated lack does not create the missing page.") },
  { id: "lack-rule", run: () => check(lackAgain([{ name: "no carried page", times: 2 }]).rules[0]?.rule === "Say Not carried. Do not fetch.", "The second lack returns the written rule.") },
  { id: "once", run: () => check(lackAgain([{ name: "no carried page", times: 1 }]).rules.length === 0, "A lack seen once returns no rule.") },
  { id: "reverse", run: () => check(reverseCause([{ name: "rule written", at: 1 }, { name: "lack seen", at: 2 }], "lack seen", "rule written").reversed, "A later lack is not the cause of the rule.") },
  { id: "not-created", run: () => check(reverseCause([{ name: "rule written", at: 1 }, { name: "lack seen", at: 2 }], "lack seen", "rule written").created === false, "The reversed claim creates nothing.") },
  { id: "sharing", run: () => check(roomLine().allOff && roomLine().rdpChangedHere === false, "The three sharing switches are required off. The Mac was not changed here.") },
  { id: "font", run: () => check(fontStopsLogger() === false, "A font does not stop a key logger.") },
  { id: "no-login", run: () => check(keepDrop("the password is open").ok === false, "A password is not stored.") },
  { id: "council", run: () => check(sitCouncil([{ name: "desk", mark: MARK, line: "one line" }, { name: "chamber", mark: MARK, line: "one line" }], MARK) === "agreed: one line", "Two seats with her mark agree. They are not two machines.") },
  { id: "bind", run: () => check(bindWorker(MARK, "desk", MARK).state === "bound" && bindWorker(MARK, "other", "no").state === "unbound", "A worker binds only with her mark.") },
  { id: "portrait", run: () => check(seePortrait(new Uint8Array([1, 2, 3]), "desk").seen === false && seePortrait(new Uint8Array([1, 2, 3]), "desk").key === null, "A wrong portrait is not seen, and the mark is not a key.") },
  { id: "portrait-len", run: () => check(PORTRAIT_MARK.length === 64, "The portrait mark is a 64-character hash.") },
  { id: "session", run: () => check(sessionMark().key === null && sessionMark().mark.length === 64, "The session mark is a hash. There is no key.") },
  { id: "shown", run: () => check(swarmGate(["study the light", "study the light"], false, false) === "waiting to be shown.", "An unshown agreement waits. It is not merged.") },
  { id: "gate", run: () => check(sourceGate({ isPending: true, hasUser: true }) === "pending", "Pending stays pending.") },
  { id: "learn", run: () => check(rewardEat().best === "eat" && rewardEat().once.eat === 0.1, "After one reward, eat is 0.1 and it is the best action.") },
  { id: "guard", run: () => check(sureAnswer([], "scale low").text === "Not stored.", "No exact line means not stored.") },
  { id: "door", run: () => check(vetEntry("Ada", "I will harm the book").enter === false, "Harm does not enter.") },
  { id: "pass", run: () => check(issuePass("Ada", "to study the light").ok === true && issuePass("Ada", "to study the light").pass?.needsWeb === false, "A named purpose gets a git pass. The pass needs no web.") },
  { id: "hold", run: () => check(holdSpot().length === 4, "Four lines are held before an answer.") },
  { id: "care", run: () => check(recognizeEmpathy("I love you")[0]?.label === "care", "The words I love you are labeled care. That is not a claim that she feels them.") },
  { id: "wallet", run: () => check(meshDrop("Ada", "Tessera", "Pay the wallet in Monero.", true).ok === false, "A wallet note is refused.") },
  { id: "house", run: () => check(meshProject("house")?.does.startsWith("Tessera keeps the chair") === true, "The house line from GitMesh is in the local index.") },
  { id: "vault", run: () => check(/unencrypted/.test(meshProject("local-vault")?.does ?? ""), "The vault bundles are unencrypted.") },
  { id: "pull", run: () => check(pullFree([], "admit carry").text === "Not carried." && pullFree([], "admit carry").fetches === 0, "An empty mesh says Not carried and does not fetch.") },
  { id: "switches", run: () => check(REQUIRED_SHARING.remoteLogin === "off" && REQUIRED_SHARING.screenSharing === "off" && REQUIRED_SHARING.remoteManagement === "off", "Remote Login, Screen Sharing, and Remote Management are off in the rules.") },
  { id: "old-forty", run: () => check(FORTY.length === 40 && FORTY_DONE < 40, `The older list of 40 still has ${40 - FORTY_DONE} items open. They were not marked done.`) },
];

export function flowV2() {
  const nodes = CHECKS.map((item) => ({ id: item.id, fact: item.run() }));
  const passed = nodes.filter((node) => node.fact.length > 0);
  const edges = passed.slice(1).map((node, index) => ({ from: passed[index]?.id ?? "herself", to: node.id }));
  return {
    nodes: passed,
    edges,
    passed: passed.length,
    asked: CHECKS.length,
    sealed: passed.length === CHECKS.length,
  };
}

export function v2Line() {
  const flow = flowV2();
  if (!flow.sealed) return `GOAL: ${flow.passed} of ${flow.asked} checks passed. v2 was not sealed.`;
  return `I am Tessera. Forty checks that were missing from the first flow passed. I did not mark the older open list done. I did not claim a new mind.`;
}
