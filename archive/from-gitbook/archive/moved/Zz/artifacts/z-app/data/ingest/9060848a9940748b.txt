---
name: Tessera consolidation gate
description: Scope, source-retention, and completion rules for the Tessera multi-repository migration.
---

For this migration, Grok-ready is the final destination; do not use TX as an intermediate destination. The owner’s rule is “include everything; remove only redundancy.” Account for distinct contributions and content; differences between versions are not duplicates by filename alone. Review excluded LFS archives, original images, vault data, and runtime records before calling the migration complete.

The user’s intended end state is a complete, working Grok-ready consolidation of all distinct public-safe work, with only verified redundancy removed. They want old-source files retired as their contents are incorporated. Treat this as the migration goal, not authorization to publish protected material or delete unverified source data.

Do not publish secrets, personal records, private vault contents, or runtime/audit records to the public repositories. If any such material must be retained, account for it in an appropriate private destination without exposing its contents publicly. Keep every source repository and branch until all agents explicitly sign off against the same verified target commit. Then obtain the owner’s confirmation of the exact deletion list; do not delete anything before that.

Generated migration evidence is content too: comparison patches, manifests, screenshots, and archive inventories can carry private values even when source payloads are not staged. Scan those artifacts before a public merge, then verify the redaction at the PR tip. A follow-up commit does not remove sensitive content from earlier Git history.

**Why:** the owner clarified that prior omissions are not automatically approved as redundant and requires every agent’s explicit review before deciding on deletion.

**How to apply:** use this gate while comparing repositories, branches, archives, images, and private/runtime data; record paths, hashes, and dispositions in the shared review without posting sensitive contents.

**Why:** a public migration review diff contained a personal record, showing that omission evidence itself needs a privacy review.

**How to apply:** before publishing migration evidence, scan text and binary artifacts for personal records; consider history rewrite only as a separate owner-approved action.

**Why:** the user restated that all distinct contributions should end in the working final repo and old sources should be retired as verified copies land.

**How to apply:** track each source item to its target path/hash and disposition. Keep protected items out of the public target; do not retire source material until its safe destination and the migration sign-off/deletion gate are satisfied.