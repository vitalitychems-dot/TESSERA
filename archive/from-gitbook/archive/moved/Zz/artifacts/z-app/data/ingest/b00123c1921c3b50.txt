---
name: Tessera consolidation gate
description: Scope, source-retention, and completion rules for the Tessera multi-repository migration.
---

For this migration, Grok-ready is the final destination; do not use TX as an intermediate destination. The owner’s baseline is “include everything; remove only verified redundancy,” subject to this updated exclusion: keep crypto-, trading-, arbitrage-, finance-, Vitality-, and store-related files/features out of the public destination. Account for other distinct contributions; differences between versions are not duplicates by filename alone.

The user’s intended end state is a complete, working Grok-ready consolidation of all distinct public-safe work not explicitly excluded above, with only verified redundancy removed. They want old-source files retired as their contents are incorporated. Treat this as the migration goal, not authorization to publish protected material or delete unverified source data.

Do not publish secrets, personal records, private vault contents, or runtime/audit records to the public repositories. If any such material must be retained, account for it in an appropriate private destination without exposing its contents publicly. Keep every source repository and branch until all agents explicitly sign off against the same verified target commit. Then obtain the owner’s confirmation of the exact deletion list; do not delete anything before that.

Generated migration evidence is content too: comparison patches, manifests, screenshots, and archive inventories can carry private values even when source payloads are not staged. Scan those artifacts before a public merge, then verify the redaction at the PR tip. A follow-up commit does not remove sensitive content from earlier Git history.

**Why:** the owner clarified that prior omissions are not automatically approved as redundant and requires every agent’s explicit review before deciding on deletion.

**How to apply:** use this gate while comparing repositories, branches, archives, images, and private/runtime data; record paths, hashes, and dispositions in the shared review without posting sensitive contents.

**Why:** a public migration review diff contained a personal record, showing that omission evidence itself needs a privacy review.

**How to apply:** before publishing migration evidence, scan text and binary artifacts for personal records; consider history rewrite only as a separate owner-approved action.

**Why:** source UI fixtures and screenshots can contain unredacted personal text or credential flows even when filenames and basic secret-pattern scans appear harmless.

**How to apply:** inspect embedded dialogue, fixtures, and media visually or with privacy-preserving OCR before publishing; never expose raw OCR text or copy a source variant that removes destination redactions.

**Why:** the user restated that all distinct contributions should end in the working final repo and old sources should be retired as verified copies land.

**How to apply:** track each source item to its target path/hash and disposition. Keep protected items out of the public target; do not retire source material until its safe destination and the migration sign-off/deletion gate are satisfied.

**Why:** on 2026-10-03 the owner explicitly excluded crypto, trading, arbitrage, finance, Vitality, and store-related work from the public destination.

**How to apply:** exclude those categories from migration candidates, but do not delete source repositories or files until the exact deletion list is reviewed and confirmed.