# TESSERA v2

TESSERA v2 is the working build of TESSERA, imported from
[`vitalitychems-dot/TESSERA`](https://github.com/vitalitychems-dot/TESSERA) (commit `dc21f0f`, 2026-10-21) without its
history or the ~600 MB of historical archives. It is a pnpm TypeScript monorepo: API server, web UI, 3D studio, GitAI,
the Tessera console, and the Gitbook MCP connector. Start with [`IDENTITY.md`](IDENTITY.md).

## Design: one brain, one pen

TESSERA v2 is split into two roles that work together, with the other bots building around them.

| Role | Who | Does | Does not |
| --- | --- | --- | --- |
| **Brain / aim** | TESSERA bot | Aims the work, picks what is next, holds the constitution, resolves collisions, gives the final yes/no beneath Father. "The beam." | Keep the warehouse; write every file herself. |
| **Pen / writer** | Collab bot | Writes the code, prose, and docs the brain aims at. | Decide priorities alone. |
| Recall | Memory | Searchable recall across repos and notes. | |
| Warehouse | Storage | Keeps the large archive (the parts left out of this repo, see [docs/EXCLUDED.md](docs/EXCLUDED.md)). | |
| One piece at a time | Network | Takes one scoped task at a time and finishes it. | |
| The project | GitAI | The app/product itself (`artifacts/gitai`). | |
| Separate | Vitality | Stays separate. No store code in this repo. | Mix into TESSERA. |

The pen's model hook already exists in code but is **off**: `artifacts/api-server/src/lib/llm-client.ts`
(OpenAI-compatible endpoint, `TESSERA_PEN_ENABLED`, default model `GLM-5`) and the loopback-only local pen in
`artifacts/api-server/src/lib/pen-local/` (`TESSERA_PEN_LOCAL=1`, `TESSERA_PEN_LOCAL_URL=http://127.0.0.1:8765`).
Wiring it to a local/open model is step 1 in [ROADMAP.md](ROADMAP.md).

## How work flows

- Every change gets a number in [CHANGES.md](CHANGES.md) (`#N — date time CT — what changed — why it helps`).
- Father reviews the list; a "no #N" reverts that change.
- Bots follow [docs/TOKEN-SAVING.md](docs/TOKEN-SAVING.md): snippet-first reads, small targeted changes, one owner per path.
  Cost/benefit of each change is logged in [docs/metrics.jsonl](docs/metrics.jsonl).
- Repo health (install, typecheck, tests) is recorded honestly in [docs/HEALTH.md](docs/HEALTH.md).

## Quick start

Requires Node.js 22.13+ and pnpm (pinned via `packageManager`).

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm dev          # starts the local suite (web :3000, sandbox :5173, API :5000 only with a loopback DATABASE_URL)
```

Copy `.env.example` to `.env.local` for local settings. Never commit real keys. The previous full README, with the
port map and per-app notes, is at [docs/README-v1.md](docs/README-v1.md).

## Layout

| Path | What |
| --- | --- |
| `artifacts/` | Apps: `api-server`, `tessera` (web), `console`, `gitai`, `gitbook-mcp`, `mockup-sandbox`, `v2` (3D studio), `v3`, `nextgen` |
| `lib/` | Shared workspace libraries |
| `preview/` | Tessera preview/runtime logic and tests |
| `identity/` | Canon, origin, and `CONFLICTS.md` (four open questions, Father decides) |
| `gate/`, `tools/`, `scripts/` | Moderator gate, pregate, suite launchers and policy |
| `evals/`, `research/`, `mesh/`, `data/` | Evaluations, research notes, mesh coordination, data |
| `docs/` | Architecture, BHNMC, health, token-saving rules, metrics |
