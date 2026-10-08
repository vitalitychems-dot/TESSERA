# Memory and source-graph scan

Date: 2026-10-08. Tool: the local source graph described in `artifacts/api-server/src/lib/v2/source-graph.ts`. Flowsint is the idea it was tailored from. Flowsint is not installed, and no Flowsint service was called.

## What the walk covered

- 240 TypeScript modules under `TESSERA/artifacts/api-server/src/lib`.
- 657 import edges between those modules.
- The walk stopped at the scanner's own limits: 400 files, depth 6, 256 KB each. This run did not hit those limits.
- The Gitbook archive was counted by folder. The files inside were not read line by line.

## Memory

The retrieval memory is eight modules: `bm25`, `distill`, `improve`, `index`, `redact`, `store`, `text`, and `types`. Its own note says it stores text, ranks it, and proposes lessons. It does not train weights.

The provenance-memory check in this repository passed, including the new record `MEM-SCAN-2026-10-08`.

## What was not done

- The 4,899 files under `archive/moved/Zz` were not opened.
- `1T` is not a live repository anymore. Eleven unique files from it are in `archive/moved/1T`.
- This scan did not change the running app.
