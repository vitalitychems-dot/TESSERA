# TESSERA v3

- `src/crystal.mjs`: crystal memory. It is an append-only, content-addressed log of the memory graph. Each fact has x, y, z (3D layout), t (the log line where it first appeared) and v (the measured value: how many source lines asserted it). Each fact also links back to its source `file:line`. `docs/v3/crystal.jsonl` is built from `docs/v2/v2-memory.jsonl` by `node artifacts/v3/scripts/build-crystal.mjs`. It is served read-only at `GET /brain/snapshot?src=crystal&t=&prev=`, which uses the same response shape as the v2 snapshot.
- `src/pack.mjs`: context packing for the v2 context ranker. It dedupes repeated observations, prunes stopwords and common words, packs items one line each under a type header, and keeps a sink plus a 16-word window per item.
- Benchmarks: `node src/bench.mjs <memory.jsonl>` and `node src/bench-pack.mjs <memory.jsonl>` use the same 87-relation held-out split as v2 bench4.
- No `TESSERA_ENABLE_*` flags and no workflow changes.
