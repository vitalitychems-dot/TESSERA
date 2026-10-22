import test from "node:test";
import assert from "node:assert/strict";
import { verdictsFor, entryFrom, staleShas, refresh } from "./scan-cache.mjs";

const SHA = "54b8a84cb8698bcd6f060a5eea20cbbff9cce81a";
const c = (body, login = "x") => ({ body, author: { login }, createdAt: "2026-10-13T00:00:00Z" });

test("gate verdicts only count when they name this head SHA", () => {
  const v = verdictsFor(SHA, [c("Security PASS 54b8a84"), c("Moderator FAIL deadbeef"), c("Build PASS on 54b8a84cb86")]);
  assert.equal(v.gates.Security.verdict, "PASS");
  assert.equal(v.gates.Build.verdict, "PASS");
  assert.equal(v.gates.Moderator, undefined);
});

test("later verdict for the same SHA wins; scan results are captured", () => {
  const v = verdictsFor(SHA, [c("Security FAIL 54b8a84"), c("Security PASS 54b8a84"), c("REA-scan: CLEAN 54b8a84")]);
  assert.equal(v.gates.Security.verdict, "PASS");
  assert.equal(v.scans["REA-scan"].verdict, "CLEAN");
});

test("settled SHAs are not stale; pending or new are", () => {
  const cache = { entries: { a: { ci: "SUCCESS" }, b: { ci: "PENDING" } } };
  assert.deepEqual(staleShas([{ pr: 1, sha: "a" }, { pr: 2, sha: "b" }, { pr: 3, sha: "c" }], cache).map((h) => h.pr), [2, 3]);
});

test("warm read on unchanged SHAs costs exactly one call and writes nothing", async () => {
  const pr = { number: 7, title: "t", headRefName: "b", headRefOid: SHA, commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS" } } }] }, comments: { nodes: [c("Security PASS 54b8a84")] } };
  let stored = null; const calls = [];
  const t = {
    graphql(q) {
      calls.push("gql");
      if (q.includes("pullRequests(")) return { repository: { cache: stored && { oid: "o", text: stored }, pullRequests: { nodes: [{ number: 7, headRefOid: SHA }] } } };
      return { repository: { p7: pr } };
    },
    rest(path, method, body) { calls.push(method || "GET"); if (method === "PUT") stored = Buffer.from(body.content, "base64").toString(); return { object: { sha: "m" } }; },
  };
  const cold = await refresh(t);
  assert.equal(cold.fetched, 1);
  assert.equal(cold.cache.entries[SHA].gates.Security.verdict, "PASS");
  calls.length = 0;
  const warm = await refresh(t);
  assert.deepEqual(calls, ["gql"]);
  assert.equal(warm.fetched, 0);
  assert.equal(warm.changed, false);
  assert.deepEqual(entryFrom(pr), warm.cache.entries[SHA]);
});
