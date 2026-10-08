---
name: GitHub commits to symlinked trees
description: A safe workaround for GitHub API writes to repositories containing imported symlinks.
---

When GitHub rejects a tree because `.gitattributes` entries are symlinks, materialize only those entries as regular files that reference the same content blobs. Preserve the rest of the symlink tree.

**Why:** This allowed additive commits while keeping imported content bytes unchanged; flattening all symlinks would unnecessarily alter the source tree.

**How to apply:** Inspect symlink modes before API writes. If required, convert only the blocked `.gitattributes` paths to regular-file entries, then verify their blob content and the remaining symlink count. Do not flatten other symlinks without user approval.
