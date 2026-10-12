# TESSERA v2 plan snapshot

Vendored 2026-10-12 so later agents can read the plan without the planner workspace.

- Feature-map counts: [`feature-map-summary.json`](feature-map-summary.json)
- Knowledge graph: [`v2-memory.jsonl`](v2-memory.jsonl) (MCP memory server shape). Point `MEMORY_FILE_PATH` at this file.
- Full narrative stays in the planner's TESSERA-V2-PLAN. This directory is the in-repo copy of the counts and the graph.

Hard limits stay in force: no wallets, payments, trading, mining, 1T, or vault imports; no people-OSINT; no history rewrites.
