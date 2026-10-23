import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../src/crystal.mjs";
import { parseFacets, prismResolve, wrapStorageUntrusted } from "../src/prism.mjs";

const crystalText = readFileSync(new URL("../../../docs/v3/crystal.jsonl", import.meta.url), "utf8");
const crystalCells = parse(crystalText);
const v2MemoryRows = readFileSync(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const sampleFacets = [
  "gbrain | keywords: garrytan, gbrain, MIT, REA-PERMITTED-014 | TESTED https://github.com/garrytan/gbrain@16d39281 | SIMULATION MIT — cleared for pattern and code reuse",
  "hermes-agent | keywords: NousResearch, hermes-agent, MIT, REA-PERMITTED-002 | TESTED https://github.com/NousResearch/hermes-agent@cb757fac | SIMULATION MIT — cleared for pattern and code reuse",
  "arc-task-gen | keywords: pathwaycom, arc-task-gen, MIT, REA-PERMITTED-012 | TESTED https://github.com/pathwaycom/arc-task-gen@20b22030 | SIMULATION MIT — cleared for pattern and code reuse",
].join("\n");

const sampleCatalog = {
  items: [
    {
      id: "gbrain",
      repo: "garrytan/gbrain",
      head_sha: "16d3928111fa2dfad2e3011fd93ddae3acad7a1a",
      license: { value: "MIT" },
      purpose: { value: "Postgres-native personal and multi-agent knowledge brain with <script> tag test." },
      card_content_sha256: "24319f4a76abfdf010d92665d6227f85f0fceea3dadd764b1166bb6e32fdac6e",
    },
  ],
};

const sampleDedupe = {
  same_name_different_content: [
    {
      source: "tesserav2:docs/TOKEN-SAVING.md",
      prior_location: "TESSERA:docs/TOKEN-SAVING.md",
      disambiguated_storage_path: "consolidated/tesserav2/docs/TOKEN-SAVING.md",
      norm_sha256: "aaaa",
      prior_norm_sha256: "bbbb",
    },
  ],
  exact_content_matches_sample: [
    {
      canonical_path: "TESSERA:IDENTITY.md",
      norm_sha256: "cccc",
      duplicate_sources: ["tesserav2:IDENTITY.md"],
    },
  ],
};

test("Prism Laser-Crystal resolves 5D crystal coordinates, facets, and untrusted storage item under budget", () => {
  const facets = parseFacets(sampleFacets);
  assert.equal(facets.length, 3);
  assert.equal(facets[0].id, "gbrain");

  const res = prismResolve("garrytan/gbrain", {
    crystalCells,
    v2MemoryRows,
    facetsText: sampleFacets,
    storageCatalog: sampleCatalog,
    dedupeManifest: sampleDedupe,
    budgetTokens: 240,
    nonce: "prismtest01",
  });

  assert.equal(res.ok, true);
  assert.equal(res.refused, false);
  assert.equal(res.integrityVerified, true);
  assert.equal(res.laserTarget, "repo::garrytan/gbrain");
  assert.ok(res.crystalCoordinates);
  assert.equal(res.crystalCoordinates.id, "repo::garrytan/gbrain");
  assert.equal(res.crystalCoordinates.p.length, 3);
  assert.ok(res.packedTokens > 0 && res.packedTokens <= 240);
  assert.ok(res.matchedFacets.some((f) => f.id === "gbrain"));
  assert.ok(res.storageItem);
  assert.equal(res.storageItem.repo, "garrytan/gbrain");
  assert.match(res.storageItem.wrappedPayload, /^<untrusted nonce="prismtest01" role="storage" label="garrytan\/gbrain">/);
  assert.match(res.storageItem.wrappedPayload, /&lt;script&gt;/);
});

test("Prism Laser-Crystal resolves content-dedupe disambiguation and refuses restricted queries", () => {
  const diffRes = prismResolve("TOKEN-SAVING.md", {
    crystalCells,
    v2MemoryRows,
    facetsText: sampleFacets,
    dedupeManifest: sampleDedupe,
    budgetTokens: 200,
  });
  assert.equal(diffRes.ok, true);
  assert.equal(diffRes.dedupeResolution?.kind, "SAME_NAME_DIFFERENT_CONTENT");
  assert.equal(diffRes.dedupeResolution?.record.disambiguated_storage_path, "consolidated/tesserav2/docs/TOKEN-SAVING.md");

  for (const blocked of ["p-e-w/heretic", "defaultnamehere/zzzzz", "vitalitychems", "1T", "FlareSolverr"]) {
    const r = prismResolve(blocked, { crystalCells, v2MemoryRows, facetsText: sampleFacets });
    assert.equal(r.ok, false, blocked);
    assert.equal(r.refused, true, blocked);
    assert.equal(r.reason, "PEN-REFUSE-BOUNDARY", blocked);
  }
  assert.match(wrapStorageUntrusted("a < b & c > d", { nonce: "n1" }), /a &lt; b &amp; c &gt; d/);
});
