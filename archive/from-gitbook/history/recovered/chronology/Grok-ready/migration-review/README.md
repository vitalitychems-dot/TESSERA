# Source omission review — not a migration sign-off

Shared review: https://github.com/vitalitychems-dot/Grok-ready/issues/1

Compared candidate: `4072851ad13536b3e65cbd7fecfe73d306038d32` (1,578 files). The candidate is not yet accepted as the final migration. This review adds archival evidence and missing source files without overwriting its application.

## Findings

- **443 files absent at their original paths are already represented by identical Git blob hashes at other paths.** See `represented-at-other-paths.json`; these must not be restored as redundant copies.
- **119 byte-unique source-code files were not found anywhere in that candidate:** 113 TSX files and six Python/MJS helpers. They are preserved under `archives/migration-review/`, with original paths and hashes in `preserved-source-files.json`. They are not wired into the active application; agents must determine which features to integrate or explicitly document as superseded.
- The original local LFS ZIP was opened and safely salvaged: **154 previously absent project files** (106 TSX, 40 PNG, eight TXT), excluding nested Git/dependency/environment/build material and protected records. See `local-archive-salvage.json`. The raw ZIP is not uploaded as another redundant container; that does not by itself prove all its useful contents have been accepted in the final tree.
- The three remote archive repositories were reconstructed and checked. Their salvage contained 1,439 byte-unique files, with 2,211 exact source-variant duplicates and 22 staging matches omitted. See `remote-archive-verification.json`. After comparison with the newer candidate, many salvaged files were already present at different paths and are not copied again.
- **1,204 byte-unique source media files (411,898,709 bytes) are not present as identical blobs in the candidate.** `raw-media-inventory.json` lists paths, sizes, and hashes without republishing the raw contents. Different bytes can mean an optimized replacement, a summary, a privacy-sensitive reference, or genuinely missing content; byte mismatch alone is not a deletion or restoration decision.
- The candidate's `docs/IMAGE_SUMMARIES.md` inventories 1,296 images / 1,238 unique contents, but reports only seven visual summaries. Most entries still say visual summary pending. An inventory is not a replacement for the missing visual information.
- **66 shared paths differ** between the collected staging snapshot and the newer candidate. The newer candidate is retained. These differences do not by themselves establish missing functionality. The private source-variant patch is withheld from the public repository because it contained personal information; review source versions privately before sign-off.

The counts above describe specific compared collections, not a claim that every differing legacy version is a required feature. Drafted handoff documents in the staging comparison are not automatically additional product requirements.

## Protected exclusions and outstanding work

The protected `artifacts/api-server/.local-data/natal-vault.json` was not inspected or uploaded. Private vault, credential/environment, and runtime chat/audit/applicant records remain excluded from the public review branch. Those exclusions require explicit owner/agent accounting; they are not duplicate proofs and do not authorize deletion of their source repositories.

This content audit does not verify application behavior or a passing build. It does not cover unknown uncommitted/unpushed work. At audit time, read-only access to 37 configured subrepl remotes failed host-key verification; a captured local merged-branch manifest preserves additional committed contributions, but does not prove every workspace's outstanding work is included. A later scoped update in issue #1 identified the 39th local ref and reported its admin-token changes already byte-identical in the candidate. That addresses the observed 38/39 local-ref discrepancy for that branch only; it does not resolve access to the configured remotes or verify other agents' pending work.

Each agent must compare its repository, branches, and pending work with the same proposed Grok-ready candidate, report source IDs and verification results in issue #1, and explicitly sign off. The owner must confirm the exact deletion list afterward.

**No source repository has been deleted by this review. The full migration is not verified complete.**