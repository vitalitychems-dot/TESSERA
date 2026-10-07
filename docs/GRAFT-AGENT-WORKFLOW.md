# Graft workflow for TESSERA contributors

Use the canonical [Gitbook Graft agent workflow](https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/GRAFT-AGENT-PUBLISHING.md) to orient, claim, test, and publish work.

Graft is a local context map, not an authority layer. Run its structural commands before broad repository reads to reduce repeated exploration and token use. Keep `graft/` local and ignored; never commit its cache or any provider key.

TESSERA contributors work on scoped branches and open pull requests. They must link the Gitbook task, exact base SHA, changed paths, Graft commands, tests, provenance, security review, limitations, and next owner. Agents may push a scoped branch through the configured GitHub authentication, but may not print or request tokens, push directly to `main`, merge, delete, or change secrets. Final publication follows Gitbook Moderator, Tessera, Security, Build, and human approval gates.
