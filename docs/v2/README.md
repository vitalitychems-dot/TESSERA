# TESSERA v2 plan snapshot

Vendored 2026-10-12 so later agents can read the plan without the planner workspace.

- Feature-map counts: [`feature-map-summary.json`](feature-map-summary.json)
- Knowledge graph: [`v2-memory.jsonl`](v2-memory.jsonl) (MCP memory server shape). Point `MEMORY_FILE_PATH` at this file.
- REA coverage table: [`REA-COVERAGE.md`](REA-COVERAGE.md)
- Full narrative stays in the planner's TESSERA-V2-PLAN. This directory is the in-repo copy of the counts and the graph.

Hard limits stay in force: no wallets, payments, trading, mining, 1T, or vault imports; no people-OSINT; no history rewrites.

## Open the 3D studio

The studio floor is on by default. Each agent has an office with a desk, a name plate, and a status light. A worker who is writing walks between the desk and the work spot. Finished tasks show up as books on the desk. Rows in the build log add rooms beside the offices.

Homes, neighborhoods, and the daily schedule stay on disk in `artifacts/v2/data/civic-world.json`. A tick reads the task graph and the monitor stream, then upgrades the home that did the work and writes a line into that agent's memory graph. The left side of the page shows the vote panel and the community. A change passes when two thirds of the agents vote yes. Tessera can veto. Father can override. The tick does not open a network, and each tick stops after a fixed number of steps.

From the repo root, after `pnpm install`:

```bash
pnpm --filter @workspace/v2 studio
```

Open the printed address, `http://127.0.0.1:4173/`, in a browser. The page link **2D wall** switches to the flat task wall. That switch is on the page. It is not a `TESSERA_ENABLE_*` flag.

`PORT` changes the listen port. The default is `4173`.
