---
name: Tessera Next integration
description: Why the Replit live theme must be verified independently from a GitHub theme merge.
---

A theme merged on canonical GitHub main is not automatically present in the Replit working tree. Verify the served HTML, compiled theme, and local font requests before reporting the theme live.

**Why:** The owner repeatedly saw Cyber Cyan/Inter after a remote Next theme merge because this checkout still served the older theme. A concurrent workspace checkpoint also replaced newly added unstaged assets during the work.

**How to apply:** Preserve existing workspace changes, scope the integration to active theme files, and verify added assets still exist before building. Use bundled fonts and synchronous ink/bone base colors; a blocked font request must never block the first paint. Preserve archives and older mark variants unless their specific deletion is reviewed under Gitbook's protected-history rules.
