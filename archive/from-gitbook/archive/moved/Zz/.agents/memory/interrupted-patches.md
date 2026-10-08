---
name: Interrupted patch verification
description: Partial tool success messages do not guarantee that edits survived a server disconnect.
---

After a patch-tool server disconnect, check that each intended edit actually
exists before continuing, even if individual operations reported success.

**Why:** An interrupted multi-file patch reported several successful updates
that were absent when the files were checked afterward.

**How to apply:** Compare the intended changes with a focused diff or grep.
Reapply only missing edits, then run the normal verification once the coherent
change is present.
