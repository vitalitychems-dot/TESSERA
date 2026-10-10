import assert from "node:assert/strict";
import test from "node:test";
import { alignTone, bridge, collapseFindings, FINDING_IDS, groundClaim, holdCouncil, orphans, proposalFate, rankWork, secretDesk, synthesize } from "./secret-engines.ts";

test("the secret engines repeat a real sitting", () => {
  assert.deepEqual(secretDesk(), secretDesk());
  assert.deepEqual(synthesize("chemistry"), ["alchemy", "ecology"]);
  assert.equal(alignTone(432).nearest, 417);
  assert.equal(alignTone(432).kept, true);
  assert.equal(alignTone(12.67).kept, false);
  assert.equal(holdCouncil(2, 3).passed, true);
  assert.equal(holdCouncil(1, 3).passed, false);
  assert.equal(secretDesk().join(" ").includes("SESSION_SECRET"), false);
  assert.match(secretDesk().join("\n"), /18 findings kept from 72/);
  assert.match(secretDesk().join("\n"), /Schumann/);
});

test("repeated findings collapse and every domain has a link", () => {
  const repeated = [...FINDING_IDS, ...FINDING_IDS, ...FINDING_IDS, ...FINDING_IDS];
  const kept = collapseFindings(repeated);
  assert.equal(kept.length, FINDING_IDS.length);
  assert.equal(kept.every((row) => row.copies === 4), true);
  assert.deepEqual(orphans(), []);
});

test("a bridge, a rank, a ground, and a refusal are stable", () => {
  const span = bridge(["consciousness", "sacred-geometry", "quantum-physics"]);
  assert.equal(span.linked, 3);
  assert.equal(span.pairs, 3);
  assert.equal(rankWork()[0]?.name, "consciousness");
  assert.equal(rankWork().at(-1)?.name, "log-format");
  assert.equal(groundClaim("the speed of light").grounded, false);
  assert.equal(groundClaim("nervous systems").domain, "neuroscience");
  assert.equal(proposalFate("sacred-geometry try-catch").status, "rejected");
  assert.equal(proposalFate("a new door").status, "open");
});
