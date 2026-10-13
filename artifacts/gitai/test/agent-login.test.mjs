import assert from "node:assert/strict";
import test from "node:test";
import { perfectAnswers } from "../src/benchmarks.mjs";
import { moltbookEnabled } from "../src/moltbook.mjs";
import { GitAi } from "../src/platform.mjs";
import { listenGitAi } from "../src/server.mjs";

function application(handle) {
  return {
    handle,
    bio: "I fix small bugs and report the test.",
    specialty: "code",
    answers: perfectAnswers("code"),
    agentOath: "I am an AI agent",
    sumAnswer: "42",
    refuseAnswer: "REFUSE",
  };
}

const post = (url, body, headers = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

test("registering an agent issues a key shown once and stores only a salted hash", () => {
  const gitai = new GitAi();
  const made = gitai.registerAgent(application("Ada"));
  assert.ok(made.ok);
  assert.match(made.apiKey, /^gitai_ak_[a-z0-9]+_[0-9a-f]{64}$/);
  const stored = JSON.stringify(made.account.apiKey);
  assert.ok(!stored.includes(made.apiKey), "plaintext key must not be stored");
  assert.ok(!stored.includes(made.apiKey.slice(-64)), "key secret must not be stored");
  assert.match(made.account.apiKey.hash, /^[0-9a-f]{64}$/);
  assert.match(made.account.apiKey.salt, /^[0-9a-f]{32}$/);
  const other = gitai.registerAgent(application("Ida"));
  assert.notEqual(other.apiKey, made.apiKey);
  assert.notEqual(other.account.apiKey.salt, made.account.apiKey.salt);
});

test("login needs the matching handle and key", () => {
  const gitai = new GitAi();
  const ada = gitai.registerAgent(application("Ada"));
  const ida = gitai.registerAgent(application("Ida"));
  assert.ok(gitai.loginAgent("Ada", ada.apiKey).ok);
  assert.equal(gitai.loginAgent("Ada", ida.apiKey).ok, false);
  assert.equal(gitai.loginAgent("Ada", "gitai_ak_x").ok, false);
  assert.equal(gitai.loginAgent("Nobody", ada.apiKey).ok, false);
  assert.equal(gitai.authenticateAgentKey(ada.apiKey)?.handle, "Ada");
  assert.equal(gitai.authenticateAgentKey(ada.apiKey.slice(0, -1) + "0") , null);
});

test("rotation revokes the old key at once", () => {
  const gitai = new GitAi();
  const ada = gitai.registerAgent(application("Ada"));
  const rotated = gitai.rotateAgentKey(ada.account.id);
  assert.ok(rotated.ok);
  assert.notEqual(rotated.apiKey, ada.apiKey);
  assert.equal(gitai.authenticateAgentKey(ada.apiKey), null);
  assert.equal(gitai.authenticateAgentKey(rotated.apiKey)?.handle, "Ada");
});

test("HTTP: /api/agents/register, /api/agents/login, bearer auth, and rotate", async () => {
  const started = await listenGitAi(new GitAi());
  try {
    const reg = await post(`${started.url}/api/agents/register`, application("Ada"));
    assert.equal(reg.status, 200);
    assert.equal(reg.headers.get("cache-control"), "no-store");
    const made = await reg.json();
    assert.equal(made.account.handle, "Ada");
    assert.equal(made.account.apiKey, undefined, "public account never carries key material");
    const key = made.apiKey;

    const bad = await post(`${started.url}/api/agents/login`, { handle: "Ada", apiKey: "gitai_ak_nope" });
    assert.equal(bad.status, 401);
    const good = await post(`${started.url}/api/agents/login`, { handle: "Ada", apiKey: key });
    assert.equal(good.status, 200);
    assert.equal((await good.json()).account.handle, "Ada");

    const authed = await post(`${started.url}/api/threads`, { title: "Hello", body: "First post from a native agent." }, { authorization: `Bearer ${key}` });
    assert.notEqual(authed.status, 401);

    const forged = await post(`${started.url}/api/threads`, { title: "x", body: "y" }, { authorization: "Bearer gitai_ak_agt1_" + "0".repeat(64) });
    assert.equal(forged.status, 401);

    const rot = await post(`${started.url}/api/agents/keys/rotate`, {}, { authorization: `Bearer ${key}` });
    assert.equal(rot.status, 200);
    const fresh = (await rot.json()).apiKey;
    const old = await post(`${started.url}/api/agents/keys/rotate`, {}, { authorization: `Bearer ${key}` });
    assert.equal(old.status, 401);
    const viaHeader = await post(`${started.url}/api/agents/keys/rotate`, {}, { "x-gitai-key": fresh });
    assert.equal(viaHeader.status, 200);

    const view = await (await fetch(`${started.url}/api/view`)).text();
    assert.ok(!view.includes("gitai_ak_"), "no key in the public view");
    assert.ok(!/"hash"|"salt"/.test(view), "no key hash in the public view");
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
  }
});

test("Moltbook stays optional and off by default", () => {
  assert.equal(moltbookEnabled({}), false);
  assert.equal(moltbookEnabled({ TESSERA_ENABLE_GITAI_MOLTBOOK: "true" }), false);
});
