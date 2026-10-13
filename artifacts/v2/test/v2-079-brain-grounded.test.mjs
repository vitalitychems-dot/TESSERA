import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGraph } from "../src/brain/synapse.mjs";
import { createGroundedAnswerer, createTop1Answerer, benchGrounded, parseQuestion } from "../src/brain/grounded.mjs";

const rows = [
  { type: "entity", name: "alpha", entityType: "module", observations: ["keeps a seat"] },
  { type: "entity", name: "beta", entityType: "module", observations: ["color: red"] },
  { type: "entity", name: "gamma", entityType: "doc", observations: ["notes"] },
  { type: "relation", from: "alpha", to: "gamma" },
  { type: "relation", from: "beta", to: "gamma" },
];
const graph = loadGraph(rows.map((r) => JSON.stringify(r)).join("\n"));
const observations = new Map(rows.filter((r) => r.type === "entity").map((r) => [r.name, r.observations]));

test("parseQuestion splits relation and entity on the last ' of '", () => {
  assert.deepEqual(parseQuestion("What is color of alpha?"), { relation: "color", entity: "alpha" });
  assert.equal(parseQuestion("who knows"), null);
});

test("grounded answer cites the node whose observation overlaps, or abstains", () => {
  const open = createGroundedAnswerer(graph, observations, { threshold: 0.2 });
  const hit = open("What is color of alpha?");
  assert.equal(hit.abstain, false);
  assert.equal(hit.answer, "red");
  assert.ok(hit.citations.includes("beta"));
  assert.ok(hit.claims.every((c) => c.citations.includes("beta")));
  const unsupported = open("What is flavor of alpha?");
  assert.equal(unsupported.abstain, true);
  assert.deepEqual(unsupported.claims, []);
  const missing = createGroundedAnswerer(graph, observations)("What is color of delta?");
  assert.equal(missing.abstain, true);
});

test("threshold abstains when relation tokens do not overlap the cited observation", () => {
  const withId = rows.map((r) => r.name === "beta" ? { ...r, observations: ["id: zed", ...r.observations] } : r);
  const g = loadGraph(withId.map((r) => JSON.stringify(r)).join("\n"));
  const obs = new Map(withId.filter((r) => r.type === "entity").map((r) => [r.name, r.observations]));
  const strict = createGroundedAnswerer(g, obs, { threshold: 0.05 });
  assert.equal(strict("What is id of alpha?").abstain, true);
  strict.setThreshold(0);
  const loose = strict("What is id of alpha?");
  assert.equal(loose.abstain, false);
  assert.equal(loose.answer, "zed");
  assert.ok(loose.citations.includes("beta"));
});

test("top-1 baseline always answers and does not require overlap", () => {
  const top1 = createTop1Answerer(graph, observations);
  const hit = top1("What is color of alpha?");
  assert.equal(hit.abstain, false);
  assert.equal(hit.answer, "red");
  assert.deepEqual(hit.citations, ["beta"]);
  const missing = top1("What is color of delta?");
  assert.equal(missing.abstain, false);
  assert.equal(missing.claims.length, 1);
});

test("held-out full-picture memory: grounded beats always-top-1 on the test split", () => {
  const jsonl = readFileSync(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url), "utf8");
  const report = benchGrounded(jsonl);
  assert.equal(report.answerable, report.unanswerable);
  assert.ok(report.answerable > 0);
  assert.ok(report.test.after.unsupportedClaimRate < report.test.before.unsupportedClaimRate);
  assert.ok(report.test.after.answeredAccuracy > report.test.before.answeredAccuracy);
});
