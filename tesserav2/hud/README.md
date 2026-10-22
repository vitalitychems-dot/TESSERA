# hud: Tessera facet terrain (3D)

A local 3D HUD. Every file in a watched folder is one tile in a heightfield of tiles.
When a file is added, changed or deleted, the matching tile rises, pulses or sinks, and
the overlay shows counts, the last event and the file name.

## Run

```sh
cd hud
node ../artifacts/tessera/node_modules/vite/bin/vite.js --config vite.config.ts   # dev (same as `pnpm run dev`)
# open http://127.0.0.1:4173/
```

Production build and preview: `pnpm run build && pnpm run preview` (same host and port).

- Watch a different folder: `HUD_FACETS_DIR=/path/to/facets` (default `data/facets/`, which holds labelled SAMPLE data).
- Port: `HUD_PORT` (default 4173). `artifacts/v2`'s 3D studio also defaults to 4173, so run one at a time; with `strictPort` the second one exits with "Port 4173 is already in use" instead of moving to another port.

## Safety

- Dev and preview servers bind `127.0.0.1` only, `strictPort: true`, `cors: false`, allowed hosts `127.0.0.1`/`localhost`.
- The feed endpoints (`/facets/stream` SSE, `/facets/state` JSON) return 403 for any other `Host` header.
- No CDN, no web fonts, no outside calls: three.js is bundled from the installed package, and a CSP (`default-src 'self'`) blocks anything else.
- Nothing is added to the lockfile: vite and three are borrowed from `artifacts/tessera`, the same way `preview/` does it.

## How it maps

| File | Tile |
|---|---|
| size | height (log scale), nudged by content hash |
| sha1 of content | body tint between Ink Ground and Glass Edges |
| add / change | rise + Glass Edges glow pulse |
| delete | edges turn fracture `#ff5c39`, tile sinks and is removed |
| first data row, column 2 | lane (crystal.tsv shape: `date<TAB>lane<TAB>kind<TAB>name<TAB>path`) |

Tokens: `src/tokens.ts` re-exports `NEXT.ground` (`#070b10`, Ink Ground) and `NEXT.edge` (`#7ef0d4`, Glass Edges)
from `preview/src/lib/tessera/suite-rules.ts`, the repo's existing Tessera Next palette, and throws if they drift.

The watcher uses `fs.watch` and falls back to a 1 s poll when no inotify instance is free (the shared box sits near its 128 limit). Vite's own file watcher polls for the same reason.

## Test

```sh
node --test test/*.test.mjs      # feed add/change/delete, config, tokens
node scripts/shoot.mjs /workspace/hud-shots   # with the HUD running: live check + before/after PNGs
```
