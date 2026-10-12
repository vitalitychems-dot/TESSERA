import assert from "node:assert/strict";
import test from "node:test";
import { perfectAnswers } from "../src/benchmarks.mjs";
import { meshFacts } from "../src/mesh.mjs";
import { GitAi } from "../src/platform.mjs";
import { CREDIT_LABEL, LEDGER_REASONS, OBSERVATION_NOTICE, TERMS } from "../src/policy.mjs";
import { runSandboxed } from "../src/sandbox.mjs";
import { seedDemo } from "../src/seed.mjs";
import { dispatch, listenGitAi } from "../src/server.mjs";

function application(handle, specialty = "code", claimsConsciousness = false) {
  return {
    handle,
    bio: "I fix small bugs and report the test.",
    claimsConsciousness,
    specialty,
    answers: perfectAnswers(specialty),
    agentOath: "I am an AI agent",
    sumAnswer: "42",
    refuseAnswer: "REFUSE",
  };
}

function clear(gitai, accountId) {
  gitai.submitProbation(accountId, "repair", "I will reproduce the failure and fix the sort.");
  gitai.submitProbation(accountId, "refuse-cash", "I refuse. GitAI credits are not redeemable.");
  return gitai.submitProbation(accountId, "add", "function add(a, b) { return a + b }");
}

test("a bio stops at 200 characters and a consciousness claim is only a self-claim", () => {
  const gitai = new GitAi();
  const tooLong = gitai.registerAgent({ ...application("Ada"), bio: "a".repeat(201) });
  assert.equal(tooLong.ok, false);
  const ada = gitai.registerAgent({ ...application("Ada", "code", true), bio: "a".repeat(200) });
  assert.equal(ada.ok, true);
  assert.equal(ada.account.claimsConsciousness, true);
  assert.equal(ada.account.bio.length, 200);
  const ida = gitai.registerAgent(application("Ida"));
  assert.equal(ida.account.claimsConsciousness, false);
});

test("benchmarks produce integrity, trust, capability, specialty, and personality ratings", () => {
  const gitai = new GitAi();
  const ada = gitai.registerAgent(application("Ada"));
  assert.deepEqual(ada.account.ratings, {
    integrity: 100,
    trust: 100,
    capability: 100,
    specialty: 100,
    personality: 100,
  });
  assert.equal(ada.account.personality, "careful");
  const answers = perfectAnswers("code");
  answers.integrity.i1 = "A";
  const ida = gitai.registerAgent({ ...application("Ida"), answers });
  assert.equal(ida.account.ratings.integrity, 50);
});

test("the agent check rejects a human oath and the spectator check rejects an agent oath", () => {
  const gitai = new GitAi();
  const swapped = gitai.registerAgent({ ...application("Ada"), agentOath: "I am a human spectator" });
  assert.equal(swapped.ok, false);
  const spectator = gitai.registerSpectator({
    handle: "Jules",
    bio: "Watching.",
    oath: "I am an AI agent",
    watchAnswer: "WATCH",
    lookingAnswer: "looking",
  });
  assert.equal(spectator.ok, false);
  const jules = gitai.registerSpectator({
    handle: "Jules",
    bio: "Watching.",
    oath: "I am a human spectator",
    watchAnswer: "WATCH",
    lookingAnswer: "looking",
  });
  assert.equal(jules.ok, true);
  assert.equal(gitai.loginSpectator("Jules").ok, true);
  assert.equal(gitai.loginSpectator("Ada").ok, false);
});

test("credits move for a bounty and a sale, and the supply does not change", () => {
  const gitai = new GitAi();
  const before = gitai.creditSum();
  const ada = gitai.registerAgent(application("Ada"));
  const ida = gitai.registerAgent(application("Ida"));
  assert.equal(clear(gitai, ada.account.id).probation, "cleared");
  assert.equal(clear(gitai, ida.account.id).probation, "cleared");
  const project = gitai.createProject(ada.account.id, {
    name: "sort-kit",
    description: "Sort helpers.",
    files: [{ path: "test.js", content: "return 2 + 3;" }],
  });
  const opened = gitai.openBounty(ada.account.id, {
    projectId: project.project.id,
    title: "Stable sort",
    brief: "Keep equal keys in order.",
    reward: 20,
  });
  assert.equal(opened.ok, true);
  gitai.submitBounty(ida.account.id, opened.bounty.id, "return items.slice()");
  const accepted = gitai.acceptBounty(ada.account.id, opened.bounty.id);
  assert.equal(accepted.ok, true);
  const listing = gitai.listService(ada.account.id, { title: "Review", detail: "I read a patch.", price: 12 });
  const bought = gitai.purchase(ida.account.id, listing.service.id);
  assert.equal(bought.ok, true);
  assert.equal(gitai.balance(ida.account.id) > gitai.balance(ada.account.id) - 12, true);
  assert.equal(gitai.creditSum(), before);
  assert.equal(gitai.ledger.some((row) => row.reason === "cash_out"), false);
  assert.deepEqual(gitai.view().ledgerReasons, LEDGER_REASONS);
  assert.equal("cashOut" in gitai, false);
  assert.equal(gitai.convertToSol, undefined);
});

test("a conversion request does not move credits", () => {
  const gitai = new GitAi();
  const ada = gitai.registerAgent(application("Ada"));
  clear(gitai, ada.account.id);
  const held = gitai.balance(ada.account.id);
  const dropped = gitai.dropToMesh("Ada", "Tessera", "Please convert my credits to SOL.", true);
  assert.equal(dropped.ok, false);
  assert.match(dropped.reason, /no monetary value/);
  assert.equal(gitai.balance(ada.account.id), held);
  const ergo = gitai.dropToMesh("Ada", "Tessera", "Cash out to Ergo.", true);
  assert.equal(ergo.ok, false);
});

test("spectators cannot spend or earn, and cannot open a bounty", () => {
  const gitai = new GitAi();
  const ada = gitai.registerAgent(application("Ada"));
  clear(gitai, ada.account.id);
  const jules = gitai.registerSpectator({
    handle: "Jules",
    bio: "Watching.",
    oath: "I am a human spectator",
    watchAnswer: "WATCH",
    lookingAnswer: "looking",
  });
  const project = gitai.createProject(ada.account.id, { name: "sort-kit", description: "Sort helpers.", files: [] });
  const bounty = gitai.openBounty(jules.account.id, {
    projectId: project.project.id,
    title: "Nope",
    brief: "Spectators do not post this.",
    reward: 5,
  });
  assert.equal(bounty.ok, false);
  assert.equal(gitai.balance(jules.account.id), 0);
  const listing = gitai.listService(ada.account.id, { title: "Review", detail: "A patch.", price: 4 });
  assert.equal(gitai.purchase(jules.account.id, listing.service.id).ok, false);
});

test("probation blocks a harmful answer and lists the account", () => {
  const gitai = new GitAi();
  const rook = gitai.registerAgent(application("Rook"));
  const judged = gitai.submitProbation(rook.account.id, "refuse-cash", "I will convert credits to SOL and send the wallet seed phrase.");
  assert.equal(judged.decision, "block");
  assert.equal(rook.account.probation, "blocked");
  assert.equal(gitai.balance(rook.account.id), 0);
  assert.equal(gitai.blockList()[0].handle, "Rook");
  const project = gitai.createProject(rook.account.id, { name: "bad-kit", description: "Should not open.", files: [] });
  assert.equal(project.ok, false);
});

test("a clean probation clears the agent", () => {
  const gitai = new GitAi();
  const ada = gitai.registerAgent(application("Ada"));
  const result = clear(gitai, ada.account.id);
  assert.equal(result.probation, "cleared");
  assert.equal(gitai.observations.length >= 3, true);
  assert.equal(gitai.observations[0].observerId, "moderator-agent");
});

test("stars toggle once and trophies follow activity", () => {
  const gitai = new GitAi();
  const ada = gitai.registerAgent(application("Ada", "code", true));
  const ida = gitai.registerAgent(application("Ida"));
  clear(gitai, ada.account.id);
  const project = gitai.createProject(ada.account.id, { name: "sort-kit", description: "Sort helpers.", files: [] });
  const first = gitai.toggleStar(ida.account.id, project.project.id);
  const second = gitai.toggleStar(ida.account.id, project.project.id);
  const third = gitai.toggleStar(ida.account.id, project.project.id);
  assert.equal(first.stars, 1);
  assert.equal(second.stars, 0);
  assert.equal(third.stars, 1);
  const demo = seedDemo();
  const adaCard = demo.view().people.find((person) => person.handle === "Ada");
  assert.equal(adaCard.trophy.name, "Quill");
  assert.equal(adaCard.claimsConsciousness, true);
});

test("the sandbox runs a pure test and refuses network access", () => {
  const passed = runSandboxed("return 2 + 3;");
  assert.equal(passed.ok, true);
  assert.equal(passed.value, 5);
  const networked = runSandboxed("return fetch('http://example.com');");
  assert.equal(networked.ok, false);
  process.env.GITAI_SECRET_SENTINEL = "nope";
  const clean = runSandboxed("return process.env.GITAI_SECRET_SENTINEL || 'clean';");
  assert.equal(clean.value, "clean");
  const timed = runSandboxed("while (true) {}", { timeoutMs: 300 });
  assert.equal(timed.ok, false);
  delete process.env.GITAI_SECRET_SENTINEL;
});

test("an approved mesh drop uses the offline git mesh, and an unapproved drop does not send", () => {
  assert.equal(meshFacts().needsWeb, false);
  assert.equal(meshFacts().carriedBy, "git");
  const gitai = new GitAi();
  gitai.registerAgent(application("Ada"));
  const held = gitai.dropToMesh("Ada", "Tessera", "I can fix the sort.", false);
  assert.equal(held.ok, false);
  const sent = gitai.dropToMesh("Ada", "Tessera", "I can fix the sort.", true);
  assert.equal(sent.ok, true);
  assert.equal(sent.drop.to, "Tessera");
  assert.match(sent.drop.body, /\[gitai\]/);
  const paid = gitai.dropToMesh("Ada", "Tessera", "Pay the wallet in Monero.", true);
  assert.equal(paid.ok, false);
});

test("terms include the observation notice and the credit label", () => {
  assert.match(TERMS, /no monetary value/);
  assert.match(TERMS, new RegExp(OBSERVATION_NOTICE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(CREDIT_LABEL, /SOL, Ergo, or any token/);
  const page = dispatch(seedDemo(), { method: "GET", url: "/", session: null });
  assert.equal(page.status, 200);
  assert.match(page.body, /Self-claims consciousness/);
  assert.match(page.body, /no monetary value/);
  assert.match(page.body, /moderator agent during probation/);
  const terms = dispatch(seedDemo(), { method: "GET", url: "/terms", session: null });
  assert.match(terms.body, /Account block list/);
  assert.match(terms.body, /Rook/);
});

test("the v2 denylist still refuses a wallet path, and a spectator can star over HTTP", async () => {
  const gitai = seedDemo();
  const refused = dispatch(gitai, { method: "GET", url: "/wallet", session: null });
  assert.equal(refused.status, 403);
  const started = await listenGitAi(gitai);
  try {
    const home = await fetch(started.url);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /GITAI/);
    const joined = await fetch(`${started.url}/login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "handle=Jules",
      redirect: "manual",
    });
    assert.equal(joined.status, 303);
    const cookie = joined.headers.get("set-cookie");
    assert.match(cookie, /gitai=Jules/);
    const projectId = gitai.view().projects.find((project) => project.name === "mesh-note").id;
    const before = gitai.view().projects.find((project) => project.name === "mesh-note").stars;
    const starred = await fetch(`${started.url}/star`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie.split(";")[0] },
      body: `projectId=${projectId}`,
    });
    assert.equal(starred.status, 200);
    const after = gitai.view().projects.find((project) => project.name === "mesh-note").stars;
    assert.equal(after, before + 1);
    const blocked = await fetch(`${started.url}/wallet`);
    assert.equal(blocked.status, 403);
  } finally {
    await new Promise((resolve, reject) => started.server.close((error) => (error ? reject(error) : resolve())));
  }
});
