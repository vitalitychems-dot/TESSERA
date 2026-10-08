---
name: Repository migration policy
description: Canonical destination and source-retention rules confirmed by the owner.
---

Everything is the selected new public destination. Grok-ready and TX are source repositories; preserve unique contributions rather than treating differing filenames or versions as duplicate proof.

**Why:** The owner chose a new repository named Everything rather than renaming Grok-ready, then authorized migration writes under the admin identity for this migration.

**How to apply:** Build Everything from a content-reviewed snapshot without inheriting unsafe source history. Compare all source refs against it, document unresolved omissions, and keep attribution accurate.

For exact deduplication, compare repository paths and Git blob IDs against the local snapshot. Do not fetch source blob contents until candidates are selected for review; exclude private/runtime paths from comparison and copying.

**Why:** GitHub tree metadata supports exact content comparison without downloading every source file, and private runtime material must stay outside the public migration.

**How to apply:** Hash local files using Git's blob header and byte length, compare remote path/blob metadata, keep detailed inventories private, and fetch only approved candidates for content review.

Keep all old repositories until every agent agrees that its contributions are accounted for and the owner confirms the exact deletion list.

**Why:** The owner explicitly confirmed this deletion gate.

**How to apply:** Never infer agreement from migration notices, silence, or an inventory alone. Do not delete repositories during collection or while omissions remain unresolved.