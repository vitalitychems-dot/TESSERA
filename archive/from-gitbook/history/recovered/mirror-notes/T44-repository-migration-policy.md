---
name: Repository migration policy
description: Canonical destination and source-retention rules confirmed by the owner.
---

`vitalitychems-dot/Zz` on `main` is the selected migration destination. All other owner-controlled Tessera repositories are source candidates; preserve unique contributions rather than treating differing filenames or versions as duplicate proof.

**Why:** The owner confirmed Zz as the destination after the earlier migration record named Everything.

**How to apply:** Build Zz from a content-reviewed snapshot without inheriting unsafe source history. Compare current refs from all source candidates against it, document unresolved omissions, and keep attribution accurate. Preserve every source repository until source-agent sign-offs and the owner's exact deletion list are confirmed.

For exact deduplication, compare repository paths and Git blob IDs against the local snapshot. Do not fetch source blob contents until candidates are selected for review; exclude private/runtime paths from comparison and copying.

**Why:** GitHub tree metadata supports exact content comparison without downloading every source file, and private runtime material must stay outside the public migration.

**How to apply:** Hash local files using Git's blob header and byte length, compare remote path/blob metadata, keep detailed inventories private, and fetch only approved candidates for content review.

Recursive GitHub tree reads can be rate-limited when issued in a burst. Retry failed tree reads sequentially at a lower rate; never treat a 429 response as an empty tree.

**Why:** A parallel tree-read batch returned HTTP 429 for five refs, while sequential retries retrieved their metadata.

**How to apply:** Preserve the exact ref and commit for each retry, and include every tree result before drawing repository-overlap conclusions.

Keep all old repositories until every agent agrees that its contributions are accounted for and the owner confirms the exact deletion list.

**Why:** The owner explicitly confirmed this deletion gate.

**How to apply:** Never infer agreement from migration notices, silence, or an inventory alone. Do not delete repositories during collection or while omissions remain unresolved.