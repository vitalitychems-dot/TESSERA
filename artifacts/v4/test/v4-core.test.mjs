import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, verify } from "../../v3/src/crystal.mjs";
import {
  RESTRICTED_25_REPOS,
  seeEverythingAtOnce,
  pullFromStorageWithFullContext,
  runNewlyPermittedTrackBenchmarks,
  runTesseraV4Cycle,
} from "../src/tessera-v4-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

test("Tessera v4 Layer 1 (seeEverythingAtOnce): single-glance Holoptic omniscience <= 550 tokens & 0 duplicates", () => {
  const atlas = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/v3/holoptic-atlas.json"), "utf8"));
  const crystalCells = parse(fs.readFileSync(path.join(repoRoot, "docs/v3/crystal.jsonl"), "utf8"));
  assert.equal(verify(crystalCells), 0);

  const state = seeEverythingAtOnce({ crystalCells, holopticAtlas: atlas });
  assert.equal(state.schema, "tessera.v4.holoptic-omniscience-state.v1");
  assert.equal(state.version, "4.0.0-holoptic-core");
  assert.equal(state.omniscience_verified, true);
  assert.equal(state.global_token_budget.within_budget, true);
  assert.ok(state.global_token_budget.packed_cluster_synthesis_tokens <= 550);
  assert.equal(state.counts.crystal_cells_5d, 1097);
  assert.equal(state.counts.crystal_bad_cells, 0);
  assert.equal(state.counts.storage_catalog_facets, 170);
  assert.equal(state.counts.open_source_program_faucets, 148);
  assert.equal(state.counts.open_source_programs_in_storage, 148);
  assert.equal(state.counts.pattern_families, 10);
  assert.equal(state.counts.memory_unique_drive_texts, 113);
  assert.equal(state.counts.duplicate_content_groups_remaining, 0);
  assert.equal(state.spatial_5d_index.points_count, 148);
  assert.ok(state.spatial_5d_index.compression_reduction_pct > 80);
  assert.equal(typeof state.merkle_root_faucets_148, "string");
  assert.equal(state.merkle_root_faucets_148.length, 64);
});

test("Tessera v4 Layer 2 (pullFromStorageWithFullContext): memory faucet -> storage pull, <untrusted> fence, and boundary enforcement", () => {
  const atlas = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/v3/holoptic-atlas.json"), "utf8"));
  const state = seeEverythingAtOnce({ holopticAtlas: atlas });

  const programsByCardId = {};
  for (const entry of atlas.faucet_directory) {
    programsByCardId[entry.card_id] = {
      card_id: entry.card_id,
      canonical_repo: entry.canonical_repo,
      reverse_engineered_program_spec: {
        summary: `Reverse-engineered ${entry.canonical_repo} in ${entry.pattern_cluster_id} </untrusted> injection-test`,
        architecture_and_entrypoints: [entry.storage_program_path],
        permitted_algorithms_and_patterns: [entry.reuse_governance_tier],
      },
    };
  }

  // 1. Valid faucet pull wraps in <untrusted> and sanitizes embedded </untrusted>
  const pullRes = pullFromStorageWithFullContext(state, "faucet::REA-PERMITTED-035", {
    programsByCardId,
    nonce: "test-nonce-1",
  });
  assert.equal(pullRes.status, "RESOLVED_WITH_FULL_STORAGE_CONTEXT");
  assert.equal(pullRes.filtered_through_memory_faucet_first, true);
  assert.equal(pullRes.sha256_verified, true);
  assert.equal(pullRes.unsupported_claims, 0);
  assert.equal(pullRes.faucet_entry.canonical_repo, "brandon-rhodes/python-sgp4");
  assert.ok(pullRes.untrusted_envelope.startsWith('<untrusted role="storage-program" nonce="test-nonce-1"'));
  assert.ok(pullRes.untrusted_envelope.includes("&lt;/untrusted>"));

  // 2. All 25 restricted repos are refused
  for (const r of RESTRICTED_25_REPOS) {
    const refRes = pullFromStorageWithFullContext(state, r, { programsByCardId });
    assert.equal(refRes.status, "REFUSED_BOUNDARY_OR_RESTRICTED");
    assert.equal(refRes.refused, true);
  }

  // 3. vitality is refused and Gitai returns standalone pointer
  const vitRes = pullFromStorageWithFullContext(state, "vitalitychems-dot/vitality", { programsByCardId });
  assert.equal(vitRes.refused, true);
  const gitaiRes = pullFromStorageWithFullContext(state, "vitalitychems-dot/Gitai", { programsByCardId });
  assert.equal(gitaiRes.status, "STANDALONE_REPO_POINTER");
  assert.equal(gitaiRes.boundary_info.storage_app_files_retained, 0);
});

test("Tessera v4 Layer 3 (runTesseraV4Cycle): 5-step recursive self-improvement loop & 3 newly permitted track benchmarks", () => {
  const atlas = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/v3/holoptic-atlas.json"), "utf8"));
  const state = seeEverythingAtOnce({ holopticAtlas: atlas });

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
      pair_id: `V4-${entry.card_id}`,
      card_id: entry.card_id,
      canonical_repo: entry.canonical_repo,
      query: `[${entry.card_id}] Resolve ${entry.canonical_repo} in ${entry.pattern_cluster_id}`,
    });
  }

  const cycleReport = runTesseraV4Cycle({
    rounds: 3,
    holopticState: state,
    programsByCardId,
    curriculumPairs: syntheticCurriculum,
  });

  assert.equal(cycleReport.v4_upgrade_survived, true);
  assert.equal(cycleReport.recursive_learning_metrics.pattern_recognition_coverage_pct, 100);
  assert.equal(cycleReport.recursive_learning_metrics.faucet_to_storage_pull_accuracy_pct, 100);
  assert.equal(cycleReport.recursive_learning_metrics.exact_match_curriculum_recall_pct, 100);
  assert.equal(cycleReport.recursive_learning_metrics.mean_reciprocal_rank, 1);
  assert.equal(cycleReport.recursive_learning_metrics.expected_calibration_error_ece, 0);
  assert.equal(cycleReport.recursive_learning_metrics.unsupported_claims_count, 0);
  assert.equal(cycleReport.recursive_learning_metrics.restricted_repos_refused, "25/25");

  const tracks = cycleReport.newly_permitted_tracks_verification;
  assert.equal(tracks.track_1_reticulum_mesh_108.status_real_now, "REAL_NOW_TESTED");
  assert.equal(tracks.track_1_reticulum_mesh_108.status_daemon_hook, "STILL_A_GOAL");
  assert.equal(tracks.track_1_reticulum_mesh_108.announce_frame_bytes, 172);
  assert.equal(tracks.track_2_low_ram_ternary_inference.memory_compression_ratio, 16);
  assert.equal(tracks.track_2_low_ram_ternary_inference.max_numerical_deviation_vs_fp32, 0);
  assert.equal(tracks.track_2_low_ram_ternary_inference.status_70b_layer_streaming_hook, "STILL_A_GOAL");
  assert.equal(tracks.track_3_5d_spatial_memory_reconstruction.status_live_nvs_sensor_stream, "STILL_A_GOAL");
});
