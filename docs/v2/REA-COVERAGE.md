# REA coverage — v2 suite (2026-10-12)

Tool: `npx -y rea-agents@6.4.0 analyze-javascript-application`.

Gitbook stage excluded `1T` and `*vault*` paths. Zz `imports/trees` were present in the staged tree. Vitality is a risk-flag reading only and is not combined into Tessera.

JSON artifacts from the planner run lived at `rea-batch/v2-rea-out/<name>.json`. This page is the in-repo table.

| Target | Relevant JS | Parsed | Coverage |
|---|---:|---:|---:|
| GitMesh | 9 | 7 | 77.8% |
| Gitbook-full | 1186 | 1006 | 84.8% |
| TESSERA | 1431 | 1367 | 95.5% |
| Zz | 137 | 115 | 83.9% |
| amber | 178 | 147 | 82.6% |
| vitality | 716 | 692 | 96.6% |
