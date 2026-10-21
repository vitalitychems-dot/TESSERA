# What was left out of tesserav2

tesserav2 was built on 2026-10-21 (CT) from `vitalitychems-dot/TESSERA` at commit
`dc21f0fd6b38a4ce3a7ccbc958e2ffc21b969df6` ("Add the identity this bot can read inside its own repo (#522)").
Only the working tree was copied. Everything below stays in the source repo and can be pulled back later if needed.

| Left out | Size / files | Why |
| --- | --- | --- |
| `.git` history of the source repo | n/a | Fresh start; history stays in `vitalitychems-dot/TESSERA`. |
| `archive/from-gitbook/` | ~403 MB | Historical Gitbook copy (brain, forum, history, intake, merge, mesh, operations, posts, review, state). Lives in Gitbook already. |
| `archive/sections/` | ~182 MB | Split section parts of older snapshots. |
| `archives/source-repositories/` | ~8.8 MB | Older source repos (`1`, `5t`, `Grok-ready`, `Zz`, `olive-giant-ever-glade`). Untrusted historical source. |
| `archives/source-variants/` | ~1.6 MB | Unselected variants (`1`, `5t`, `Everything`, `T44`, `TX`, `tessera-complete-archives`, `tessera-grok-handoff*`). |
| `archives/migration-review/` | ~3.1 MB | Legacy UI and archive helpers kept for review only (includes old Vitality UI pages). |
| `archives/README.md` | 4 KB | Index for the above. |
| `.cursor/setup` | 1 file | It runs `git config --global` and rewrites the machine-wide git identity to `vitalitychems-dot`. Not safe to ship as an auto-run hook. |
| zip files / section parts | none found outside `archive/` | Rule: no zip or split parts. |
| `node_modules/`, build output | none in source tree | Rule: install fresh with pnpm. |
| real `.env*` files | none found | Only `.env.example` is kept. |
| `.codebase-memory/` | 1 file | Ignored by the existing `.gitignore` (graph cache; must not be committed). |

Total left out: about 597 MB across ~1,450 files.

## Vitality

Vitality stays separate. No Vitality store code is in the working tree; the old storefront pages lived only in `archives/` and were left out.
Remaining mentions are text only: the source org name `vitalitychems-dot`, provenance manifests under `docs/migration-review/`,
and guard code that *blocks* Vitality topics (for example `preview/src/lib/tessera/reflect.ts`).

## Secret scan

`gitleaks 8.21.2 detect --no-git` with the repo's `.gitleaks.toml` found 2 hits, both synthetic test fixtures
(`synthetic-colonial-secret-32xxxx` / `...32yyyy` in `artifacts/api-server/src/__tests__/`). They are documented as
false positives in `.gitleaks.toml`. A ripgrep sweep for `sk-`, `ghp_`, `github_pat_`, `AKIA`, `xox?-`, `AIza`, and
private-key headers found only redaction regexes and test fixtures. `config/secrets/` holds only an all-zero example file.
