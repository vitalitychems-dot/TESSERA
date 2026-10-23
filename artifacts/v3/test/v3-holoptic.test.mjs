import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, verify } from "../src/crystal.mjs";
import {
  buildHolopticView,
  resolveFaucetToStorage,
  runRecursiveSelfImprovementLoop,
} from "../src/holoptic.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

test("v3 holoptic atlas: sees all 148 programs, 10 pattern clusters, and 1,097 crystal cells at once", () => {
  const atlasPath = path.join(repoRoot, "docs/v3/holoptic-atlas.json");
  assert.ok(fs.existsSync(atlasPath), "docs/v3/holoptic-atlas.json must exist");
  const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));

  assert.equal(atlas.schema, "tessera.v3.holoptic-atlas.v1");
  assert.equal(atlas.governance_origin, "SOVEREIGN_ORIGIN_7F3A9C");
  assert.equal(atlas.holoptic_capabilities.see_everything_at_once, true);
  assert.equal(atlas.holoptic_capabilities.filtered_through_memory_faucets_first, true);
  assert.equal(atlas.holoptic_capabilities.on_demand_storage_full_context_pull, true);
  assert.equal(atlas.holoptic_capabilities.pattern_recognition_clusters_count, 10);
  assert.equal(atlas.holoptic_capabilities.open_source_programs_count, 148);
  assert.equal(atlas.holoptic_capabilities.storage_catalog_facets_count, 170);
  assert.equal(atlas.holoptic_capabilities.open_source_faucet_table_rows, 148);
  assert.equal(atlas.holoptic_capabilities.crystal_cells_count, 1097);
  assert.equal(atlas.holoptic_capabilities.crystal_integrity_bad_cells, 0);
  assert.equal(atlas.faucet_directory.length, 148);
  assert.equal(atlas.holoptic_faucet_strip.length, 148);

  // Verify repo boundaries per Father [t34u]
  assert.equal(atlas.repo_boundaries.Gitai.role, "standalone_repo_and_app");
  assert.equal(atlas.repo_boundaries.Gitai.storage_app_files_retained, 0);
  assert.equal(atlas.repo_boundaries.vitality.role, "standalone_repo_and_app_untouched");
  assert.equal(atlas.repo_boundaries.vitality.storage_files_retained, 0);
  assert.equal(atlas.repo_boundaries.collab.canonical_storage_path, "storage:consolidated/collab/");
  assert.equal(atlas.repo_boundaries.restricted_repos_excluded, 25);

  // Verify content deduplication summary
  assert.equal(atlas.content_deduplication_summary.storage_remaining_raw_duplicates, 0);
  assert.equal(atlas.content_deduplication_summary.storage_remaining_norm_duplicates, 0);
  assert.equal(atlas.content_deduplication_summary.memory_drive_text_duplicates_removed, 14);
  assert.equal(atlas.content_deduplication_summary.memory_drive_unique_text_files_retained, 113);
  assert.equal(atlas.content_deduplication_summary.memory_remaining_raw_duplicates, 0);
  assert.equal(atlas.content_deduplication_summary.memory_remaining_norm_duplicates, 0);
  assert.equal(
    atlas.content_deduplication_summary.portrait_preserved.git_blob_sha1,
    "5dcbaf5a110ff16f9de6c41578834280f15a9749"
  );
});

test("v3 holoptic faucet-to-storage resolver & recursive self-improvement loop (148/148 = 100%)", () => {
  const atlasPath = path.join(repoRoot, "docs/v3/holoptic-atlas.json");
  const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
  const crystalCells = parse(fs.readFileSync(path.join(repoRoot, "docs/v3/crystal.jsonl"), "utf8"));
  assert.equal(verify(crystalCells), 0);

  // Synthesize lightweight in-memory program specs from faucet_directory so test is self-contained inside TESSERA
  const programsByCardId = {};
  const syntheticCurriculum = [];
  for (const entry of atlas.faucet_directory) {
    programsByCardId[entry.card_id] = {
      card_id: entry.card_id,
      canonical_repo: entry.canonical_repo,
      reverse_engineered_program_spec: {
        summary: `Reverse-engineered ${entry.canonical_repo} (${entry.pattern_cluster_id})`,
        architecture_and_entrypoints: [entry.storage_program_path],
        permitted_algorithms_and_patterns: [entry.reuse_governance_tier],
      },
    };
    syntheticCurriculum.push({
      pair_id: `TEST-${entry.card_id}`,
      card_id: entry.card_id,
      canonical_repo: entry.canonical_repo,
      query: `[${entry.card_id}] Resolve ${entry.canonical_repo} in ${entry.pattern_cluster_id}`,
    });
  }

  // Verify Reticulum #108 (REA-PERMITTED-035) resolves from memory faucet to storage program in 1 hop
  const ret = resolveFaucetToStorage(atlas, "faucet::REA-PERMITTED-035", { programsByCardId });
  assert.equal(ret.resolved, true);
  assert.equal(ret.faucet_entry.canonical_repo, "brandon-rhodes/python-sgp4");
  assert.equal(
    ret.faucet_entry.storage_program_uri,
    "storage:programs/p10-scientific-simulation/rea-permitted-035-brandon-rhodes-python-sgp4.json"
  );

  // Run 3-round recursive self-improvement loop
  const loop = runRecursiveSelfImprovementLoop({
    rounds: 3,
    holopticAtlas: atlas,
    programsByCardId,
    curriculumPairs: syntheticCurriculum,
    crystalCells,
  });

  assert.equal(loop.rounds_executed, 3);
  assert.equal(loop.all_rounds_survived, true);
  assert.equal(loop.final_metrics.pattern_recognition_coverage_pct, 100);
  assert.equal(loop.final_metrics.faucet_to_storage_pull_accuracy_pct, 100);
  assert.equal(loop.final_metrics.curriculum_recall_accuracy_pct, 100);
  assert.equal(loop.final_metrics.unsupported_claims_count, 0);
  assert.equal(loop.readiness_for_next_version_v4, true);
});
