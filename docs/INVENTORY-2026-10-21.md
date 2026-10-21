# Inventory 2026-10-21

Scope of the walk: the working tree on branch `cursor/repo-inventory-pen-health-79f1`, excluding `.git/`, `node_modules/`, and `dist/`. Those three are install or compiler output. `node_modules/` was created by the install recorded below. Archive bytes were hashed so duplicates can be counted. No zip, split-zip, or `.b64` payload was extracted.

Claim labels:

- **TESTED** — this session ran the command, or hashed/stat'd the path, and the output is below.
- **REPORTED** — read from a file or a fetched page. Not re-executed, and not treated as proof of a zip's contents.
- **SIMULATION** — a design that was not run.

## Counts

- Files walked: **3821**. Directories walked: **501**.
- Files opened (contents read in this session): **52**.
- Files not opened: **3769**.
- Unopened archives: **660** files, **571813736** bytes.
- Status counts:
  - live code: 1809
  - docs: 503
  - archived: 789
  - duplicate: 60
  - unopened archive: 660

Top-level size is the sum of walked file bytes under that directory (TESTED, `lstat` / SHA-256 walk).

| Path | Bytes | Files |
| --- | ---: | ---: |
| `archive` | 610495393 | 975 |
| `artifacts` | 12421895 | 1155 |
| `archives` | 12359511 | 474 |
| `docs` | 5532410 | 89 |
| `.agents` | 3842777 | 372 |
| `preview` | 3011377 | 517 |
| `data` | 2019332 | 11 |
| `lib` | 529530 | 57 |
| `(root files)` | 388469 | 22 |
| `scripts` | 330443 | 71 |
| `evals` | 121307 | 11 |
| `tools` | 113595 | 13 |
| `research` | 62954 | 21 |
| `config` | 45785 | 3 |
| `.github` | 28038 | 10 |
| `identity` | 24270 | 7 |
| `gate` | 16504 | 5 |
| `mesh` | 4837 | 3 |
| `deliverables` | 4729 | 1 |
| `.cursor` | 641 | 2 |
| `.codebase-memory` | 489 | 2 |

## 1. Every file and directory

The tables at the end of this file list every walked directory and every walked file with size, status, whether it was opened, and a one-line purpose. Purposes on unopened files are path inferences (REPORTED as inferences, not file-content claims).

Section zip parts under `archive/sections/3_9_1776105526328/`: TESTED byte sum of `part-*` is **189865723**. REPORTED from the sibling README, which was opened: the reassembled zip would be 189,865,723 bytes and was not unpacked. This session did not concatenate the parts and does not claim the entry count.

## 2. Architecture

### pnpm monorepo

TESTED: `pnpm install --frozen-lockfile` finished with pnpm 11.25.0, 824 packages, and the line `Scope: all 15 workspace projects`. The root `package.json` name is `workspace`. `pnpm-workspace.yaml` includes `artifacts/*`, `projects/*`, `lib/*`, `lib/integrations/*`, and `scripts`. TESTED: `projects/` and `lib/integrations/` are not directories. `preview/package.json` exists (`@workspace/preview`) and is outside those globs, so it is not one of the 15.

The 14 child packages, named from the `package.json` files that were opened for this inventory:

| Package | Path | What it does |
| --- | --- | --- |
| `@workspace/api-server` | `artifacts/api-server` | Express API on port 5000 when the suite launcher has a loopback `DATABASE_URL`. Routes mount at `/api`. WebSocket path `/ws`. |
| `@workspace/tessera` | `artifacts/tessera` | Vite web UI. Suite default port 3000. |
| `@workspace/mockup-sandbox` | `artifacts/mockup-sandbox` | Component preview. Suite default port 5173. |
| `@workspace/console` | `artifacts/console` | Node console UI. README says `127.0.0.1:4391`. |
| `@workspace/gitai` | `artifacts/gitai` | GitAI marketplace process. README says port 4183. |
| `@workspace/gitbook-mcp` | `artifacts/gitbook-mcp` | MCP and HTTP connector for the Gitbook repo. |
| `@workspace/v2` | `artifacts/v2` | 3D studio and protocol checks. README says port 4173. |
| `@workspace/v3` | `artifacts/v3` | Separate v3 tests and bench. Not started by `scripts/dev-unified.mjs`. |
| `@workspace/nextgen` | `artifacts/nextgen` | Separate Nextgen server and test. Not started by the suite launcher. |
| `@workspace/db` | `lib/db` | Drizzle/Postgres client. `getPool()` reads `DATABASE_URL` when called. |
| `@workspace/api-zod` | `lib/api-zod` | Generated Zod types package. |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI spec and Orval codegen. |
| `@workspace/api-client-react` | `lib/api-client-react` | React Query client package. |
| `@workspace/scripts` | `scripts` | Suite tests, gates, and the pen health check. |

Every package name in the table comes from an opened `package.json`. Ports that come from `README.md` are REPORTED from that README. Suite launcher behavior is from `scripts/dev-unified.mjs`. This session did not start the apps.

Shared libraries are the database and the API contracts. The API depends on `@workspace/db` and `@workspace/api-zod`. The web package declares `@workspace/api-client-react` (REPORTED from `artifacts/tessera/package.json`, which was opened far enough to see scripts; the dependency line was not in the opened slice). `docs/ARCHITECTURE-BRIDGE.md` says a search found no import of that client in `artifacts/tessera/src`. That sentence is REPORTED from the bridge doc, not re-run here.

### `artifacts/api-server`

TESTED counts from `ls`: 89 files in `src/routes`, 235 entries in `src/lib`, 136 tests in `src/__tests__`. REPORTED from the opened entry and app files: `src/index.ts` installs a fetch guard, creates an HTTP server, and attaches `ws` at `/ws`. `src/app.ts` mounts cookie parsing, CORS, JSON, and the router at `/api`. The route index pulls in health, chat, memory, council, forum, AGI, and many other routers. This inventory did not open each route.

The server is the live backend. It is not started by `pnpm dev` unless `DATABASE_URL` is a loopback Postgres URL (`scripts/dev-unified.mjs`). No `.env.local` was present (TESTED: the file was absent). `DATABASE_URL` was not set by this session.

### The pen (`src/lib/llm-client.ts`)

The hosted pen is `callTesseraPen`. It is off unless `TESSERA_PEN_ENABLED` is `1` or `true` after trim. The default in code is off. TESTED by `pnpm run pen:health` in a child process whose environment did not include that variable: `hosted_pen_enabled_in_child_env` is false.

When the flag is on, `callTesseraPen` prepends a fixed system prompt and calls `callLLM` with model `TESSERA_PEN_MODEL` or `GLM-5`. `callLLM` eventually calls `tesseraChatCompletion`, which POSTs JSON to `{TESSERA_LLM_BASE_URL}/chat/completions` with `Authorization: Bearer` and `max_completion_tokens`. That is the OpenAI-compatible shape. The base URL must be the literal host `127.0.0.1` or `[::1]`. TESTED: `decideChatLlmBaseUrl("https://api.openai.com/v1")` returns refused, and `http://127.0.0.1:8765/v1` is accepted. A public GLM endpoint would be refused by this client.

`isLLMAvailable()` is a separate switch. It returns false when `SOVEREIGN_NO_EXTERNAL_LLM` is unset or truthy (the code default is on). `callTesseraPen` does not consult `isLLMAvailable()` before calling `callLLM`. Enabling the pen still needs `TESSERA_LLM_MODEL`, a loopback base URL, and an API key, or the HTTP helper throws. This session did not set any of those.

REPORTED from `docs/agents/CURSOR-GRAPH-RULE.md`: that note still says the live pen is xAI/Grok until a tested flip. REPORTED from `docs/GLM5-PEN-ACTIVATION.md`: the owner selected GLM-5 as the instrument and left the adapter disabled. Both can be true: the code default is GLM-5 only after the flag is on, and the flag was not turned on.

### pen-local (`127.0.0.1:8765`)

pen-local is a second client, not the hosted pen. `TESSERA_PEN_LOCAL` must be exactly `1`. `true` does not enable it. TESTED by the health check. The default URL is `http://127.0.0.1:8765`. `chatCompletionsUrl` turns that into `http://127.0.0.1:8765/v1/chat/completions`. `localhost` and `https` are rejected. TESTED by the health check.

REPORTED from `pen-local/config.ts` and `pen-local/README.md`: a call also needs a weights file, a matching SHA-256 pin, a model id, and a system-prompt file. The module hashes the file. It does not load weights. If the loopback process is down, the reason is `runtime_down` and no text is invented. Pre-gate and post-gate are deterministic checks around that call. The README says this module does not read `TESSERA_PEN_ENABLED` or `TESSERA_ENABLE_*`. This session did not start anything on port 8765.

URL difference: the hosted pen appends `/chat/completions` to the configured base, so a base of `http://127.0.0.1:8765/v1` hits `/v1/chat/completions`. pen-local's bare origin `http://127.0.0.1:8765` also becomes `/v1/chat/completions`. A hosted base without `/v1` would call `/chat/completions` instead.

## 3. Compaction candidates

Proposals only. Nothing in this list was deleted.

### `cookie-parser` is used

TESTED by reading `artifacts/api-server/src/app.ts`: it imports `cookie-parser` and calls `app.use(cookieParser())`. It is not an unused dependency. Do not remove it on the example in the task.

### `google-auth-library` looks unused

REPORTED: a search under `artifacts/api-server` found `google-auth-library` only in `package.json`. No `.ts`, `.mjs`, or `.js` import was found. Proposal: remove the dependency in a later change after a runtime import check. Not done here.

### Duplicate bytes

TESTED: SHA-256 groups with more than one file. The preferred copy is the one outside `archive/` and `archives/` when one exists, otherwise the shorter path. Extra copies are marked `duplicate` in the file table unless they are unopened archives, which keep that status. Largest extra-byte groups:

| Extra bytes | Canonical | Extra copies |
| ---: | --- | ---: |
| 25344 | `preview/public/fonts/fragment-mono.woff2` | 1 |
| 14180 | `preview/public/fonts/syne-500.woff2` | 1 |
| 14152 | `preview/public/fonts/syne-700.woff2` | 1 |
| 8608 | `artifacts/tessera/src/components/ui/menubar.tsx` | 1 |
| 7608 | `artifacts/tessera/src/components/ui/calendar.tsx` | 1 |
| 7606 | `artifacts/tessera/src/components/ui/dropdown-menu.tsx` | 1 |
| 7406 | `artifacts/tessera/src/components/ui/context-menu.tsx` | 1 |
| 6210 | `artifacts/tessera/src/components/ui/carousel.tsx` | 1 |
| 6044 | `artifacts/tessera/src/components/ui/field.tsx` | 1 |
| 5745 | `artifacts/tessera/src/components/ui/select.tsx` | 1 |
| 5124 | `artifacts/tessera/src/components/ui/navigation-menu.tsx` | 1 |
| 4887 | `artifacts/tessera/src/components/ui/command.tsx` | 1 |
| 4845 | `artifacts/tessera/src/components/ui/toast.tsx` | 1 |
| 4494 | `artifacts/tessera/src/components/ui/item.tsx` | 1 |
| 4419 | `artifacts/tessera/src/components/ui/alert-dialog.tsx` | 1 |

Duplicate groups: 59 groups, 60 extra files.

### Other proposals

- `archive/` and `archives/` are historical trees (source repos `1`, `5t`, `Grok-ready`, `olive-giant-ever-glade`, `Zz`, and variant names `Everything`, `T44`, `TX`, handoff trees). They are not the packages `pnpm install` builds. Proposal: keep them until a reviewed compaction, then drop exact duplicates first.
- Unopened split zips: `Tessera-Grok-Screenshot-Supplement.zip`, `grok-workspace_1789591148371.zip.part-*`, `grok-handoff-images.zip.part-*` under two `parts/` trees, `archive/sections/3_9_1776105526328/part-0*`, and the `.b64` / `.gz.b64` blobs under `archive/from-gitbook/archive/moved/5t/.agents/outputs/`. Proposal: store them outside the git tree, or keep one copy of any byte-identical part. Do not unpack them in the repo.
- `pnpm-workspace.yaml` lists `projects/*` and `lib/integrations/*`, and those directories are absent. Proposal: delete the empty globs in a later edit.
- `preview/` has its own `package.json` and is not in the workspace. Proposal: add it to the workspace or document it as intentionally standalone. `docs/ARCHITECTURE-BRIDGE.md` says it has no `package.json`. That sentence is stale (TESTED: the file exists).
- README says UI primitives are shared through symlinks. TESTED: `find . -type l` excluding `.git` printed a count of 0. Proposal: correct the README. The UI files in `artifacts/tessera` and `artifacts/mockup-sandbox` are separate files; identical ones show up in the duplicate table.
- `.codebase-memory/artifact.json` describes an index at commit `da56a24` (REPORTED). `.gitignore` ignores `.codebase-memory/`. Proposal: decide whether the tracked index is still wanted. This session did not query a code graph; there was no `search_code` tool, so the map above is from the tree plus opened snippets.

## 4. Use, then bridge, then upgrade

### Use

Use the monorepo as it is. `pnpm run typecheck` passes. `pnpm --filter @workspace/scripts test` passes, including the pen health check. The hosted pen and pen-local stay off. Do not set `TESSERA_PEN_ENABLED`, `TESSERA_PEN_LOCAL`, or any `TESSERA_ENABLE_*` name to turn a model on. The API stays unwired from `pnpm dev` until a loopback database URL exists in the ignored env file.

### Bridge

SIMULATION. OpenManus was not cloned and was not run.

REPORTED from the README fetched at `https://raw.githubusercontent.com/FoundationAgents/OpenManus/main/README.md` on 2026-10-21: OpenManus is a Python agent. The README shows an MIT license badge. Configuration is `config/config.toml` with `[llm] base_url` pointed at an OpenAI-compatible API. The quick start is `python main.py`. Other entry points named there are `python run_mcp.py` and `python run_flow.py`. The README also says Browser Use starts as a default MCP server unless `OPENMANUS_DISABLE_BROWSER_USE=1`. OpenManus is a client of an OpenAI-compatible API. The fetched README does not describe an HTTP server that implements `/v1/chat/completions`.

REPORTED from `https://github.com/FoundationAgents/OpenManus/releases`: the page lists tag `v0.3.0` at commit `f616c5d` with the message `update _BROWSER_DESCRIPTION`. The tag was not checked out.

Feasible: yes, as a loopback worker in front of a small adapter. Not feasible as a drop-in process behind the current client, because the pen speaks HTTP and OpenManus speaks a terminal (and its own outbound LLM client).

The bridge would look like this, and none of it was implemented:

1. Leave `TESSERA_PEN_ENABLED` and `TESSERA_PEN_LOCAL` off until a later, explicit approval.
2. Run a new adapter bound only to `http://127.0.0.1:<port>`. It accepts `POST /v1/chat/completions` and returns `{ "choices": [{ "message": { "content": "..." } }] }`.
3. Point the hosted pen at it with `TESSERA_LLM_BASE_URL=http://127.0.0.1:<port>/v1` so `tesseraChatCompletion` calls `/v1/chat/completions`. Give it `TESSERA_LLM_MODEL` and `TESSERA_LLM_API_KEY`. The key can be a local dummy if the adapter checks the header and does not forward it.
4. The adapter's handler would call OpenManus in-process, or a subprocess, with tools disabled (`OPENMANUS_DISABLE_BROWSER_USE=1` and no shell tool). The reply text is the only thing returned to the pen.
5. Do not satisfy pen-local's weights pin by pointing `TESSERA_PEN_LOCAL_WEIGHTS` at the OpenManus checkout. REPORTED from the local pen README: the hash is of a file on disk and does not prove which bytes the process on port 8765 loaded. OpenManus is not a weights file.

Risks:

- OpenManus tools (browser, and whatever `main.py` can call) contradict the pen system prompt, which denies filesystem, deploy, merge, credential, and payment authority.
- A second hop: OpenManus would still call its own LLM unless that client is also pointed at a local model. That can leak prompts and requires a key in `config.toml`.
- Identity: a reply that names OpenManus or another vendor can fail the pen-local post-gate, and it breaks the hosted pen's "never name another model" line.
- Binding `0.0.0.0` would fail the pen's literal-loopback check on the client, but a mis-bound adapter could still be reachable on the host.
- Python, `uv`, and Playwright are outside this pnpm workspace. A bridge adds a second package manager and a long dependency install.
- MIT allows use. Vendoring the tree into this repo would still need a license file and a decision not to import the unopened archives' copies of anything else.
- Not run. Treat every behavior claim about OpenManus beyond the fetched README and releases page as unverified.

### Upgrade

The upgrade that landed in this branch is the pen health check in section 5. It is the step that can be re-run on later passes without enabling the pen and without depending on OpenManus.

## 5. Upgrade

`scripts/pen-health.mjs` loads the real flag readers and the real loopback classifiers. It does not assign `TESSERA_PEN_ENABLED`, `TESSERA_PEN_LOCAL`, or any `TESSERA_ENABLE_*` variable. It does not call `fetch`. The child process receives only an allow-list of ordinary environment names (`PATH`, `HOME`, and locale/temp names), so a parent value of `TESSERA_PEN_ENABLED=1` is reported as "set" and is not forwarded.

`isTesseraPenEnabled` and `isLocalPenFlagOn` now live in `artifacts/api-server/src/lib/pen-switch.ts`, which has no imports. `llm-client.ts` and `pen-local/config.ts` re-export them, so existing callers keep the same functions. The health check can load the flags without loading the database client.

Root script: `pnpm run pen:health`. The scripts package test list includes `scripts/pen-health.test.mjs`, so `pnpm --filter @workspace/scripts test` and the root `pnpm test` runner both execute it.

### TESTED: install

```
$ pnpm install --frozen-lockfile
Scope: all 15 workspace projects
Lockfile is up to date, resolution step is skipped
Packages: +824
Done in 6.7s using pnpm v11.25.0
```

### TESTED: typecheck

```
$ pnpm run typecheck
$ pnpm run typecheck:libs && pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck
$ tsc --build
Scope: 10 of 15 workspace projects
artifacts/api-server typecheck$ tsc -p tsconfig.json --noEmit
artifacts/gitbook-mcp typecheck$ tsc -p tsconfig.json --noEmit
artifacts/mockup-sandbox typecheck$ tsc -p tsconfig.json --noEmit
artifacts/tessera typecheck$ tsc -p tsconfig.json --noEmit
artifacts/gitbook-mcp typecheck: Done
scripts typecheck$ tsc -p tsconfig.json --noEmit
scripts typecheck: Done
artifacts/mockup-sandbox typecheck: Done
artifacts/api-server typecheck: Done
artifacts/tessera typecheck: Done
```

Exit code 0. Packages without a `typecheck` script (console, gitai, v2, v3, nextgen, and the libs that only have codegen or `push`) are outside that filter's script run. `typecheck:libs` still builds `lib/db`, `lib/api-client-react`, and `lib/api-zod` via `tsc --build`.

### TESTED: pen health

```
$ pnpm run pen:health
$ node scripts/pen-health.mjs
{
  "label": "TESTED",
  "network": false,
  "parent_tessera_enable_names_set": [],
  "parent_tessera_pen_enabled_is_set": false,
  "parent_tessera_pen_local_is_set": false,
  "parent_flag_names_unchanged": true,
  "child_exit": 0,
  "child": {
    "label": "TESTED",
    "network": false,
    "process_env_mutated": false,
    "child_tessera_enable_names": [],
    "hosted_pen_enabled_in_child_env": false,
    "local_pen_enabled_in_child_env": false,
    "hosted_off_on_blank_env": true,
    "hosted_on_only_for_one_or_true": true,
    "local_on_only_for_exact_one": true,
    "default_local_url": "http://127.0.0.1:8765",
    "loopback_accepts_default": true,
    "loopback_rejects_localhost": true,
    "loopback_rejects_https": true,
    "local_chat_path": "/v1/chat/completions",
    "hosted_loopback_base": "http://127.0.0.1:8765/v1",
    "hosted_chat_suffix": "/chat/completions",
    "hosted_accepts_loopback_v1": true,
    "hosted_refuses_public_openai": true,
    "hosted_missing_without_url": true
  }
}
```

Exit code 0. Direct `node --test scripts/pen-health.test.mjs` also exited 0 (1 test).

### TESTED: scripts package tests

```
$ pnpm --filter @workspace/scripts test
# tests 167
# pass 167
# fail 0
ok 120 - pen health stays off and checks loopback without touching enable flags
```

Exit code 0. Duration about 5.2s.

### TESTED: root pnpm test

```
$ pnpm test
[test] Suite safety policy
# tests 167
# pass 167
# fail 0
[test] Tessera console
ℹ tests 3
ℹ pass 3
ℹ fail 0
[test] Gitbook MCP
Test Files  1 passed (1)
Tests  30 passed (30)
[test] TESSERA v2
ℹ tests 170
ℹ pass 170
ℹ fail 0
[test] GitAI
ℹ tests 28
ℹ pass 28
ℹ fail 0
[test] Tessera API boot without database
Test Files  1 passed (1)
Tests  5 passed (5)
[test] Tessera API integration tests skipped. Set TESSERA_TEST_DATABASE_URL to a dedicated local test database (not DATABASE_URL).
[test] Tessera learning memory
Test Files  1 passed (1)
Tests  5 passed (5)
[test] Workspace test run completed.
PNPM_TEST:0
```

Exit code 0. The database-backed API integration tests were skipped because `TESSERA_TEST_DATABASE_URL` was not set. That skip line is the runner's own output.

## 6. REAL NOW status

### Counted and verified

- Working-tree walk excluding `.git`, `node_modules`, and `dist`: 3821 files, 501 directories.
- Opened 52 files. Did not open 3769 files.
- Unopened archives: 660 files, 571813736 bytes. Hashed, not extracted.
- `pnpm install --frozen-lockfile` succeeded.
- `pnpm run typecheck` succeeded.
- `pnpm run pen:health` succeeded with the pen off and the public OpenAI URL refused.
- `pnpm --filter @workspace/scripts test` : 167 passed, 0 failed.
- Root `pnpm test` exit 0: scripts 167, console 3, gitbook-mcp 30, v2 170, gitai 28, API boot 5, learning memory 5. API integration tests skipped (no `TESSERA_TEST_DATABASE_URL`).
- `cookie-parser` is mounted in the API app.
- No symlink was found outside `.git`.
- No `.env.local` file was present. No secret values were written into this document.

### Closed in this change

- A re-runnable pen health check that survives later test runs because it is on `pnpm run pen:health` and on the scripts test list.
- Flag readers moved to a file with no database import, without changing the on/off rules.
- This inventory.

### Open

- The rest of the API vitest tree. Root `pnpm test` ran the boot test and the learning-memory test, and skipped the database integration tests. This session did not set `TESSERA_TEST_DATABASE_URL`.
- `google-auth-library` removal, duplicate-byte deletion, empty workspace globs, the stale preview sentence, and the symlink sentence in the README. Proposals only.
- OpenManus bridge. SIMULATION. Not cloned, not installed, not served on port 8765.
- Pen activation. Flags were not flipped. `TESSERA_ENABLE_*` was not set or cleared.
- Archive contents. The split zips and the section parts remain unopened.
- A code-graph query. The `.codebase-memory` artifact was read as metadata only.

## Directory list

Bytes are the sum of files directly in that directory, not including subdirectories. Status for a directory is the role of the tree, not a claim that every child was opened.

```
bytes	path	purpose
388469	.	Repository root.
0	.agents	Agent skill and memory notes.
2226	.agents/memory	Agent skill and memory notes.
0	.agents/skills	Agent skill and memory notes.
6107	.agents/skills/agent-tools	Agent skill and memory notes.
10090	.agents/skills/agent-tools/references	Agent skill and memory notes.
18204	.agents/skills/audit-website	Agent skill and memory notes.
229	.agents/skills/audit-website/agents	Agent skill and memory notes.
4484	.agents/skills/audit-website/assets	Agent skill and memory notes.
7706	.agents/skills/audit-website/references	Agent skill and memory notes.
6524	.agents/skills/better-auth-best-practices	Agent skill and memory notes.
24429	.agents/skills/brainstorming	Agent skill and memory notes.
27548	.agents/skills/brainstorming/scripts	Agent skill and memory notes.
9587	.agents/skills/browser-use	Agent skill and memory notes.
6467	.agents/skills/browser-use/references	Agent skill and memory notes.
7533	.agents/skills/copywriting	Agent skill and memory notes.
8158	.agents/skills/copywriting/evals	Agent skill and memory notes.
13571	.agents/skills/copywriting/references	Agent skill and memory notes.
5446	.agents/skills/find-skills	Agent skill and memory notes.
14614	.agents/skills/frontend-design	Agent skill and memory notes.
80582	.agents/skills/next-best-practices	Agent skill and memory notes.
38085	.agents/skills/pdf	Agent skill and memory notes.
20607	.agents/skills/pdf/scripts	Agent skill and memory notes.
30353	.agents/skills/pptx	Agent skill and memory notes.
25240	.agents/skills/pptx/scripts	Agent skill and memory notes.
18012	.agents/skills/pptx/scripts/office	Agent skill and memory notes.
11321	.agents/skills/pptx/scripts/office/helpers	Agent skill and memory notes.
0	.agents/skills/pptx/scripts/office/schemas	Agent skill and memory notes.
929788	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016	Agent skill and memory notes.
0	.agents/skills/pptx/scripts/office/schemas/ecma	Agent skill and memory notes.
8678	.agents/skills/pptx/scripts/office/schemas/ecma/fouth-edition	Agent skill and memory notes.
3127	.agents/skills/pptx/scripts/office/schemas/mce	Agent skill and memory notes.
35320	.agents/skills/pptx/scripts/office/schemas/microsoft	Agent skill and memory notes.
68105	.agents/skills/pptx/scripts/office/validators	Agent skill and memory notes.
5235	.agents/skills/remotion-best-practices	Agent skill and memory notes.
106054	.agents/skills/remotion-best-practices/rules	Agent skill and memory notes.
7992	.agents/skills/remotion-best-practices/rules/assets	Agent skill and memory notes.
10723	.agents/skills/seo-audit	Agent skill and memory notes.
9833	.agents/skills/seo-audit/evals	Agent skill and memory notes.
6528	.agents/skills/seo-audit/references	Agent skill and memory notes.
2576	.agents/skills/supabase-postgres-best-practices	Agent skill and memory notes.
52486	.agents/skills/supabase-postgres-best-practices/references	Agent skill and memory notes.
44776	.agents/skills/ui-ux-pro-max	Agent skill and memory notes.
1415365	.agents/skills/ui-ux-pro-max/data	Agent skill and memory notes.
238014	.agents/skills/ui-ux-pro-max/data/stacks	Agent skill and memory notes.
65070	.agents/skills/ui-ux-pro-max/scripts	Agent skill and memory notes.
28183	.agents/skills/vercel-composition-patterns	Agent skill and memory notes.
22156	.agents/skills/vercel-composition-patterns/rules	Agent skill and memory notes.
117184	.agents/skills/vercel-react-best-practices	Agent skill and memory notes.
108208	.agents/skills/vercel-react-best-practices/rules	Agent skill and memory notes.
84170	.agents/skills/vercel-react-native-skills	Agent skill and memory notes.
74852	.agents/skills/vercel-react-native-skills/rules	Agent skill and memory notes.
1231	.agents/skills/web-design-guidelines	Agent skill and memory notes.
489	.codebase-memory	Repository directory.
641	.cursor	Repository directory.
1659	.github	CI workflows.
26379	.github/workflows	CI workflows.
0	archive	Archived tree. Children that are archives were not extracted.
7666	archive/from-gitbook	Archived tree. Children that are archives were not extracted.
366	archive/from-gitbook/.codebase-memory	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive	Archived tree. Children that are archives were not extracted.
3623	archive/from-gitbook/archive/moved	Archived tree. Children that are archives were not extracted.
585	archive/from-gitbook/archive/moved/1	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/1/artifacts	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/1/artifacts/api-server	Archived tree. Children that are archives were not extracted.
5532	archive/from-gitbook/archive/moved/1/artifacts/api-server/scripts	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/1/artifacts/api-server/src	Archived tree. Children that are archives were not extracted.
81616	archive/from-gitbook/archive/moved/1/artifacts/api-server/src/lib	Archived tree. Children that are archives were not extracted.
24023	archive/from-gitbook/archive/moved/1/artifacts/api-server/src/routes	Archived tree. Children that are archives were not extracted.
4126	archive/from-gitbook/archive/moved/1/artifacts/mockup-sandbox	Archived tree. Children that are archives were not extracted.
3107	archive/from-gitbook/archive/moved/1/artifacts/tessera	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/1/artifacts/tessera/src	Archived tree. Children that are archives were not extracted.
99855	archive/from-gitbook/archive/moved/1/artifacts/tessera/src/components	Archived tree. Children that are archives were not extracted.
42406	archive/from-gitbook/archive/moved/1/artifacts/tessera/src/components/chat	Archived tree. Children that are archives were not extracted.
23371	archive/from-gitbook/archive/moved/1/artifacts/tessera/src/hooks	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/1/lib	Archived tree. Children that are archives were not extracted.
197	archive/from-gitbook/archive/moved/1/lib/api-spec	Archived tree. Children that are archives were not extracted.
281	archive/from-gitbook/archive/moved/1/scripts	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/5t	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/5t/.agents	Archived tree. Children that are archives were not extracted.
371	archive/from-gitbook/archive/moved/5t/.agents/memory	Archived tree. Children that are archives were not extracted.
3160589	archive/from-gitbook/archive/moved/5t/.agents/outputs	Archived tree. Children that are archives were not extracted.
174530	archive/from-gitbook/archive/moved/5t/.agents/outputs/tx-t44-unique	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/5t/artifacts	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/5t/artifacts/api-server	Archived tree. Children that are archives were not extracted.
4822602	archive/from-gitbook/archive/moved/5t/artifacts/api-server/data	Archived tree. Children that are archives were not extracted.
6886	archive/from-gitbook/archive/moved/Grok-ready	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/Grok-ready/artifacts	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/Grok-ready/artifacts/api-server	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/Grok-ready/artifacts/api-server/src	Archived tree. Children that are archives were not extracted.
55908	archive/from-gitbook/archive/moved/Grok-ready/artifacts/api-server/src/lib	Archived tree. Children that are archives were not extracted.
7682	archive/from-gitbook/archive/moved/Grok-ready/artifacts/api-server/src/routes	Archived tree. Children that are archives were not extracted.
18646	archive/from-gitbook/archive/moved/Grok-ready/docs	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/Grok-ready/docs/grok-packet	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/Grok-ready/docs/grok-packet/06_SAFE_SOURCE_FILES	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/Grok-ready/docs/grok-packet/06_SAFE_SOURCE_FILES/storefront-static	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/Grok-ready/docs/grok-packet/06_SAFE_SOURCE_FILES/storefront-static/public	Archived tree. Children that are archives were not extracted.
59342	archive/from-gitbook/archive/moved/Grok-ready/docs/grok-packet/06_SAFE_SOURCE_FILES/storefront-static/public/product-images	Archived tree. Children that are archives were not extracted.
437328	archive/from-gitbook/archive/moved/Grok-ready/docs/migration-review	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/T44	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/T44/.agents	Archived tree. Children that are archives were not extracted.
441	archive/from-gitbook/archive/moved/T44/.agents/memory	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/TESS	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/TESS/artifacts	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/TESS/artifacts/api-server	Archived tree. Children that are archives were not extracted.
55196	archive/from-gitbook/archive/moved/TESS/artifacts/api-server/data	Archived tree. Children that are archives were not extracted.
157	archive/from-gitbook/archive/moved/olive-giant-ever-glade	Archived tree. Children that are archives were not extracted.
2402	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok	Archived tree. Children that are archives were not extracted.
2435	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/references	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/skills	Archived tree. Children that are archives were not extracted.
12235	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/skills/building-games	Archived tree. Children that are archives were not extracted.
12394	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/skills/imagine-grok-build	Archived tree. Children that are archives were not extracted.
6618	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/skills/xai-api	Archived tree. Children that are archives were not extracted.
18321108	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data	Archived tree. Children that are archives were not extracted.
1463	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/coordination	Archived tree. Children that are archives were not extracted.
3887371	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/ingest	Archived tree. Children that are archives were not extracted.
490916	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school	Archived tree. Children that are archives were not extracted.
8277	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/workshop	Archived tree. Children that are archives were not extracted.
3084196	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/tessera-complete-archives	Archived tree. Children that are archives were not extracted.
162428806	archive/from-gitbook/archive/moved/tessera-complete-archives/parts	Archived tree. Children that are archives were not extracted.
53000316	archive/from-gitbook/archive/moved/tessera-grok-handoff	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete	Archived tree. Children that are archives were not extracted.
162431180	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts	Archived tree. Children that are archives were not extracted.
1022163	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/source-screenshot-supplement	Archived tree. Children that are archives were not extracted.
1041320	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/source-screenshot-supplement/03-evidence	Archived tree. Children that are archives were not extracted.
4812	archive/from-gitbook/brain	Archived tree. Children that are archives were not extracted.
41619	archive/from-gitbook/brain-consciousness	Archived tree. Children that are archives were not extracted.
5245	archive/from-gitbook/brain-consciousness/provenance-memory	Archived tree. Children that are archives were not extracted.
50189	archive/from-gitbook/brain-consciousness/reports	Archived tree. Children that are archives were not extracted.
3132	archive/from-gitbook/forum	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/history	Archived tree. Children that are archives were not extracted.
17650	archive/from-gitbook/history/coordination	Archived tree. Children that are archives were not extracted.
923	archive/from-gitbook/history/recovered	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/history/recovered/chronology	Archived tree. Children that are archives were not extracted.
5769	archive/from-gitbook/history/recovered/chronology/Grok-ready	Archived tree. Children that are archives were not extracted.
294	archive/from-gitbook/history/recovered/chronology/Grok-ready/grok-packet	Archived tree. Children that are archives were not extracted.
4436	archive/from-gitbook/history/recovered/chronology/Grok-ready/migration-review	Archived tree. Children that are archives were not extracted.
819	archive/from-gitbook/history/recovered/coordination	Archived tree. Children that are archives were not extracted.
1412	archive/from-gitbook/history/recovered/coordination/cards	Archived tree. Children that are archives were not extracted.
3878	archive/from-gitbook/history/recovered/coordination/checks	Archived tree. Children that are archives were not extracted.
1922	archive/from-gitbook/history/recovered/coordination/notes	Archived tree. Children that are archives were not extracted.
7881	archive/from-gitbook/history/recovered/legacy	Archived tree. Children that are archives were not extracted.
28417	archive/from-gitbook/history/recovered/mirror-notes	Archived tree. Children that are archives were not extracted.
3134	archive/from-gitbook/history/recovered/source-index	Archived tree. Children that are archives were not extracted.
0	archive/from-gitbook/history/recovered/source-versions	Archived tree. Children that are archives were not extracted.
6188	archive/from-gitbook/history/recovered/source-versions/tessera-unified	Archived tree. Children that are archives were not extracted.
11291	archive/from-gitbook/history/recovered/source-versions/tessera-unified/docs	Archived tree. Children that are archives were not extracted.
8263	archive/from-gitbook/history/recovered/source-versions/tessera-unified/scripts	Archived tree. Children that are archives were not extracted.
58159	archive/from-gitbook/history/recovered/zz-olive	Archived tree. Children that are archives were not extracted.
9344	archive/from-gitbook/history/source-index	Archived tree. Children that are archives were not extracted.
74495	archive/from-gitbook/intake	Archived tree. Children that are archives were not extracted.
5228900	archive/from-gitbook/merge	Archived tree. Children that are archives were not extracted.
76463	archive/from-gitbook/mesh	Archived tree. Children that are archives were not extracted.
50261	archive/from-gitbook/mesh/roles	Archived tree. Children that are archives were not extracted.
22458	archive/from-gitbook/operations	Archived tree. Children that are archives were not extracted.
21677	archive/from-gitbook/posts	Archived tree. Children that are archives were not extracted.
21497	archive/from-gitbook/review	Archived tree. Children that are archives were not extracted.
8967	archive/from-gitbook/state	Archived tree. Children that are archives were not extracted.
0	archive/sections	Archived tree. Children that are archives were not extracted.
189866266	archive/sections/3_9_1776105526328	Archived tree. Children that are archives were not extracted.
579	archives	Archived tree. Children that are archives were not extracted.
0	archives/migration-review	Archived tree. Children that are archives were not extracted.
31265	archives/migration-review/archive-helpers	Archived tree. Children that are archives were not extracted.
2873162	archives/migration-review/legacy-ui	Archived tree. Children that are archives were not extracted.
1113	archives/source-repositories	Archived tree. Children that are archives were not extracted.
300067	archives/source-repositories/1	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/5t	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/5t/.agents	Archived tree. Children that are archives were not extracted.
201430	archives/source-repositories/5t/.agents/outputs	Archived tree. Children that are archives were not extracted.
813	archives/source-repositories/5t/.agents/outputs/tx-t44-unique	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/5t/artifacts	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/5t/artifacts/api-server	Archived tree. Children that are archives were not extracted.
727	archives/source-repositories/5t/artifacts/api-server/data	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Grok-ready	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Grok-ready/docs	Archived tree. Children that are archives were not extracted.
2340653	archives/source-repositories/Grok-ready/docs/migration-review	Archived tree. Children that are archives were not extracted.
434262	archives/source-repositories/Zz	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts	Archived tree. Children that are archives were not extracted.
1339	archives/source-repositories/Zz/artifacts/api-server	Archived tree. Children that are archives were not extracted.
791	archives/source-repositories/Zz/artifacts/api-server/.replit-artifact	Archived tree. Children that are archives were not extracted.
53919	archives/source-repositories/Zz/artifacts/api-server/src	Archived tree. Children that are archives were not extracted.
34352	archives/source-repositories/Zz/artifacts/api-server/src/__tests__	Archived tree. Children that are archives were not extracted.
1252	archives/source-repositories/Zz/artifacts/api-server/src/eval	Archived tree. Children that are archives were not extracted.
23358	archives/source-repositories/Zz/artifacts/api-server/src/lib	Archived tree. Children that are archives were not extracted.
28213	archives/source-repositories/Zz/artifacts/api-server/src/routes	Archived tree. Children that are archives were not extracted.
1592	archives/source-repositories/Zz/artifacts/mockup-sandbox	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/tessera	Archived tree. Children that are archives were not extracted.
12556	archives/source-repositories/Zz/artifacts/tessera/src	Archived tree. Children that are archives were not extracted.
19051	archives/source-repositories/Zz/artifacts/tessera/src/components	Archived tree. Children that are archives were not extracted.
15311	archives/source-repositories/Zz/artifacts/tessera/src/lib	Archived tree. Children that are archives were not extracted.
26963	archives/source-repositories/Zz/artifacts/tessera/src/pages	Archived tree. Children that are archives were not extracted.
12230	archives/source-repositories/Zz/artifacts/z-app	Archived tree. Children that are archives were not extracted.
35	archives/source-repositories/Zz/artifacts/z-app/.grok	Archived tree. Children that are archives were not extracted.
606	archives/source-repositories/Zz/artifacts/z-app/.replit-artifact	Archived tree. Children that are archives were not extracted.
9570	archives/source-repositories/Zz/artifacts/z-app/data	Archived tree. Children that are archives were not extracted.
2186	archives/source-repositories/Zz/artifacts/z-app/data/drive	Archived tree. Children that are archives were not extracted.
61163	archives/source-repositories/Zz/artifacts/z-app/data/knowledge	Archived tree. Children that are archives were not extracted.
407	archives/source-repositories/Zz/artifacts/z-app/data/sandbox-runs	Archived tree. Children that are archives were not extracted.
18157	archives/source-repositories/Zz/artifacts/z-app/data/school	Archived tree. Children that are archives were not extracted.
1106	archives/source-repositories/Zz/artifacts/z-app/data/tools	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip	Archived tree. Children that are archives were not extracted.
252863	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts	Archived tree. Children that are archives were not extracted.
987	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server	Archived tree. Children that are archives were not extracted.
12434	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src	Archived tree. Children that are archives were not extracted.
186886	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib	Archived tree. Children that are archives were not extracted.
15287	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/ingestion	Archived tree. Children that are archives were not extracted.
202093	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes	Archived tree. Children that are archives were not extracted.
5843	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera	Archived tree. Children that are archives were not extracted.
31663	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src	Archived tree. Children that are archives were not extracted.
222715	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/components	Archived tree. Children that are archives were not extracted.
16165	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/components/chat	Archived tree. Children that are archives were not extracted.
22057	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/hooks	Archived tree. Children that are archives were not extracted.
64190	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/lib	Archived tree. Children that are archives were not extracted.
1012398	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages	Archived tree. Children that are archives were not extracted.
343692	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/drizzle	Archived tree. Children that are archives were not extracted.
346	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/drizzle/meta	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/src	Archived tree. Children that are archives were not extracted.
17518	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/src/schema	Archived tree. Children that are archives were not extracted.
262960	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/generate2dmap	Archived tree. Children that are archives were not extracted.
18306	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/generate2dmap/scripts	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/generate2dsprite	Archived tree. Children that are archives were not extracted.
46277	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/generate2dsprite/scripts	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/video2dsprite	Archived tree. Children that are archives were not extracted.
16164	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/video2dsprite/scripts	Archived tree. Children that are archives were not extracted.
7948	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/migrations	Archived tree. Children that are archives were not extracted.
484797	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-unified-main	Archived tree. Children that are archives were not extracted.
63149	archives/source-repositories/Zz/artifacts/z-app/scripts	Archived tree. Children that are archives were not extracted.
3118	archives/source-repositories/Zz/artifacts/z-app/src	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/src/components	Archived tree. Children that are archives were not extracted.
126233	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/artifacts/z-app/src/lib	Archived tree. Children that are archives were not extracted.
1628	archives/source-repositories/Zz/artifacts/z-app/src/lib/auth	Archived tree. Children that are archives were not extracted.
130371	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/lib	Archived tree. Children that are archives were not extracted.
267	archives/source-repositories/Zz/lib/api-client-react	Archived tree. Children that are archives were not extracted.
10155	archives/source-repositories/Zz/lib/api-spec	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/lib/api-zod	Archived tree. Children that are archives were not extracted.
101	archives/source-repositories/Zz/lib/api-zod/src	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/Zz/tessera-control	Archived tree. Children that are archives were not extracted.
178415	archives/source-repositories/Zz/tessera-control/canonical	Archived tree. Children that are archives were not extracted.
276063	archives/source-repositories/olive-giant-ever-glade	Archived tree. Children that are archives were not extracted.
76	archives/source-repositories/olive-giant-ever-glade/.grok	Archived tree. Children that are archives were not extracted.
9454	archives/source-repositories/olive-giant-ever-glade/data	Archived tree. Children that are archives were not extracted.
20123	archives/source-repositories/olive-giant-ever-glade/data/coordination	Archived tree. Children that are archives were not extracted.
377129	archives/source-repositories/olive-giant-ever-glade/data/imports	Archived tree. Children that are archives were not extracted.
1197	archives/source-repositories/olive-giant-ever-glade/data/school	Archived tree. Children that are archives were not extracted.
4504	archives/source-repositories/olive-giant-ever-glade/data/tools	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/olive-giant-ever-glade/data/workshop	Archived tree. Children that are archives were not extracted.
408	archives/source-repositories/olive-giant-ever-glade/data/workshop/replit-plugin	Archived tree. Children that are archives were not extracted.
15850	archives/source-repositories/olive-giant-ever-glade/scripts	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/olive-giant-ever-glade/src	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/olive-giant-ever-glade/src/components	Archived tree. Children that are archives were not extracted.
44163	archives/source-repositories/olive-giant-ever-glade/src/components/tessera	Archived tree. Children that are archives were not extracted.
0	archives/source-repositories/olive-giant-ever-glade/src/lib	Archived tree. Children that are archives were not extracted.
44979	archives/source-repositories/olive-giant-ever-glade/src/lib/tessera	Archived tree. Children that are archives were not extracted.
0	archives/source-variants	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/1	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/1/main	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/1/main/artifacts	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/1/main/artifacts/api-server	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/1/main/artifacts/api-server/src	Archived tree. Children that are archives were not extracted.
17851	archives/source-variants/1/main/artifacts/api-server/src/__tests__	Archived tree. Children that are archives were not extracted.
6915	archives/source-variants/1/main/artifacts/api-server/src/lib	Archived tree. Children that are archives were not extracted.
106073	archives/source-variants/1/main/artifacts/api-server/src/routes	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/5t	Archived tree. Children that are archives were not extracted.
2996	archives/source-variants/5t/main	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/5t/main/.agents	Archived tree. Children that are archives were not extracted.
177	archives/source-variants/5t/main/.agents/memory	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/5t/main/artifacts	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/5t/main/artifacts/api-server	Archived tree. Children that are archives were not extracted.
30220	archives/source-variants/5t/main/artifacts/api-server/src	Archived tree. Children that are archives were not extracted.
59784	archives/source-variants/5t/main/artifacts/api-server/src/lib	Archived tree. Children that are archives were not extracted.
42530	archives/source-variants/5t/main/artifacts/api-server/src/lib/ingestion	Archived tree. Children that are archives were not extracted.
7435	archives/source-variants/5t/main/artifacts/api-server/src/routes	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/Everything	Archived tree. Children that are archives were not extracted.
60	archives/source-variants/Everything/main	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/T44	Archived tree. Children that are archives were not extracted.
841	archives/source-variants/T44/main	Archived tree. Children that are archives were not extracted.
1468	archives/source-variants/T44/main/.agents	Archived tree. Children that are archives were not extracted.
2417	archives/source-variants/T44/main/.agents/memory	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/T44/main/artifacts	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/T44/main/artifacts/api-server	Archived tree. Children that are archives were not extracted.
43436	archives/source-variants/T44/main/artifacts/api-server/src	Archived tree. Children that are archives were not extracted.
95316	archives/source-variants/T44/main/artifacts/api-server/src/lib	Archived tree. Children that are archives were not extracted.
404784	archives/source-variants/T44/main/artifacts/api-server/src/routes	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/T44/main/artifacts/tessera	Archived tree. Children that are archives were not extracted.
17641	archives/source-variants/T44/main/artifacts/tessera/src	Archived tree. Children that are archives were not extracted.
101908	archives/source-variants/T44/main/artifacts/tessera/src/components	Archived tree. Children that are archives were not extracted.
40301	archives/source-variants/T44/main/artifacts/tessera/src/components/chat	Archived tree. Children that are archives were not extracted.
6371	archives/source-variants/T44/main/artifacts/tessera/src/lib	Archived tree. Children that are archives were not extracted.
277329	archives/source-variants/T44/main/artifacts/tessera/src/pages	Archived tree. Children that are archives were not extracted.
11337	archives/source-variants/T44/main/artifacts/tessera/src/types	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/TX	Archived tree. Children that are archives were not extracted.
5771	archives/source-variants/TX/main	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/tessera-complete-archives	Archived tree. Children that are archives were not extracted.
2317	archives/source-variants/tessera-complete-archives/main	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/tessera-grok-handoff	Archived tree. Children that are archives were not extracted.
0	archives/source-variants/tessera-grok-handoff-complete	Archived tree. Children that are archives were not extracted.
4351	archives/source-variants/tessera-grok-handoff-complete/main	Archived tree. Children that are archives were not extracted.
10682	archives/source-variants/tessera-grok-handoff/main	Archived tree. Children that are archives were not extracted.
0	artifacts	Live application tree.
6555	artifacts/api-server	Live API server tree.
1041	artifacts/api-server/.replit-artifact	Live API server tree.
91575	artifacts/api-server/scripts	Live API server tree.
44505	artifacts/api-server/src	Live API server tree.
241	artifacts/api-server/src/__fixtures__	Live API server tree.
971898	artifacts/api-server/src/__tests__	Live API server tree.
1284	artifacts/api-server/src/__tests__/helpers	Live API server tree.
3909	artifacts/api-server/src/cli	Live API server tree.
4665	artifacts/api-server/src/core	Live API server tree.
1295	artifacts/api-server/src/eval	Live API server tree.
2917879	artifacts/api-server/src/lib	Live API server tree.
96546	artifacts/api-server/src/lib/admission	Live API server tree.
85294	artifacts/api-server/src/lib/agi	Live API server tree.
18465	artifacts/api-server/src/lib/heldout	Live API server tree.
195494	artifacts/api-server/src/lib/ingestion	Live API server tree.
18328	artifacts/api-server/src/lib/memory	Live API server tree.
55991	artifacts/api-server/src/lib/pen-local	Live API server tree.
4746	artifacts/api-server/src/lib/pen-local/test-fixtures	Live API server tree.
12886	artifacts/api-server/src/lib/providers	Live API server tree.
23335	artifacts/api-server/src/lib/v2	Live API server tree.
0	artifacts/api-server/src/middlewares	Live API server tree.
1145672	artifacts/api-server/src/routes	Live API server tree.
10928	artifacts/console	Live application tree.
8835	artifacts/console/lib	Live application tree.
20730	artifacts/console/public	Live application tree.
58078	artifacts/console/public/fonts	Live application tree.
356	artifacts/console/stubs	Live application tree.
9888	artifacts/console/test	Live application tree.
23232	artifacts/gitai	Live application tree.
87600	artifacts/gitai/src	Live application tree.
33559	artifacts/gitai/test	Live application tree.
9038	artifacts/gitbook-mcp	Live application tree.
71314	artifacts/gitbook-mcp/src	Live application tree.
14385	artifacts/mockup-sandbox	Live application tree.
327	artifacts/mockup-sandbox/.replit-artifact	Live application tree.
8778	artifacts/mockup-sandbox/src	Live application tree.
665	artifacts/mockup-sandbox/src/.generated	Live application tree.
0	artifacts/mockup-sandbox/src/components	Live application tree.
0	artifacts/mockup-sandbox/src/components/mockups	Live application tree.
14667	artifacts/mockup-sandbox/src/components/mockups/sovereign	Live application tree.
174146	artifacts/mockup-sandbox/src/components/ui	Live application tree.
4332	artifacts/mockup-sandbox/src/hooks	Live application tree.
166	artifacts/mockup-sandbox/src/lib	Live application tree.
3047	artifacts/nextgen	Live application tree.
3799	artifacts/nextgen/lib	Live application tree.
5736	artifacts/nextgen/public	Live application tree.
1891	artifacts/nextgen/test	Live application tree.
7141	artifacts/tessera	Live application tree.
584	artifacts/tessera/.replit-artifact	Live application tree.
40353	artifacts/tessera/public	Live application tree.
15836	artifacts/tessera/public/fonts	Live application tree.
0	artifacts/tessera/public/textures	Live application tree.
354757	artifacts/tessera/public/textures/planets	Live application tree.
33355	artifacts/tessera/src	Live application tree.
333503	artifacts/tessera/src/components	Live application tree.
196162	artifacts/tessera/src/components/chat	Live application tree.
14150	artifacts/tessera/src/components/intelligence	Live application tree.
195698	artifacts/tessera/src/components/ui	Live application tree.
44566	artifacts/tessera/src/data	Live application tree.
39531	artifacts/tessera/src/hooks	Live application tree.
245138	artifacts/tessera/src/lib	Live application tree.
1222996	artifacts/tessera/src/pages	Live application tree.
409317	artifacts/tessera/src/pages/life	Live application tree.
2011	artifacts/tessera/src/shared	Live application tree.
2117	artifacts/tessera/src/styles	Live application tree.
10761	artifacts/tessera/src/types	Live application tree.
573	artifacts/v2	Live application tree.
0	artifacts/v2/eval	Live application tree.
127606	artifacts/v2/eval/reasoning	Live application tree.
7459	artifacts/v2/scripts	Live application tree.
2916	artifacts/v2/src	Live application tree.
914	artifacts/v2/src/adapters	Live application tree.
297259	artifacts/v2/src/brain	Live application tree.
1319899	artifacts/v2/src/brain/connectomes	Live application tree.
8116	artifacts/v2/src/brain/creator	Live application tree.
777643	artifacts/v2/src/brain/rea	Live application tree.
1539	artifacts/v2/src/compute	Live application tree.
3483	artifacts/v2/src/knowledge	Live application tree.
20914	artifacts/v2/src/live	Live application tree.
14141	artifacts/v2/src/offline	Live application tree.
32071	artifacts/v2/src/opt	Live application tree.
77815	artifacts/v2/src/studio	Live application tree.
3912	artifacts/v2/src/token	Live application tree.
164614	artifacts/v2/test	Live application tree.
2483	artifacts/v2/test/fixtures	Live application tree.
96068	artifacts/v2/test/fixtures/live	Live application tree.
1400	artifacts/v3	Live application tree.
1066	artifacts/v3/scripts	Live application tree.
19518	artifacts/v3/src	Live application tree.
5409	artifacts/v3/test	Live application tree.
44347	config	Repository directory.
1438	config/secrets	Repository directory.
0	data	Repository directory.
397225	data/rea	Repository directory.
1622107	data/school	Repository directory.
4729	deliverables	Repository directory.
339023	docs	Documentation tree.
1536	docs/agents	Documentation tree.
4739	docs/cl1	Documentation tree.
11396	docs/eval	Documentation tree.
209985	docs/grok-packet	Documentation tree.
1855	docs/grok-packet/06_SAFE_SOURCE_FILES	Documentation tree.
4686	docs/grok-packet/06_SAFE_SOURCE_FILES/isolated-mockup	Documentation tree.
5760	docs/grok-packet/06_SAFE_SOURCE_FILES/isolated-mockup/src	Documentation tree.
2433	docs/grok-packet/06_SAFE_SOURCE_FILES/owner-history	Documentation tree.
591	docs/grok-packet/06_SAFE_SOURCE_FILES/simulation-reference	Documentation tree.
11409	docs/grok-packet/06_SAFE_SOURCE_FILES/simulation-reference/src	Documentation tree.
7535	docs/grok-packet/06_SAFE_SOURCE_FILES/simulation-reference/tests	Documentation tree.
7685	docs/grok-packet/06_SAFE_SOURCE_FILES/standalone-tessera-service	Documentation tree.
653	docs/grok-packet/06_SAFE_SOURCE_FILES/storefront-static	Documentation tree.
0	docs/grok-packet/06_SAFE_SOURCE_FILES/storefront-static/src	Documentation tree.
14274	docs/grok-packet/06_SAFE_SOURCE_FILES/storefront-static/src/lib	Documentation tree.
20330	docs/grok-packet/06_SAFE_SOURCE_FILES/user-provided-text	Documentation tree.
14296	docs/handoff	Documentation tree.
977	docs/image-text	Documentation tree.
858	docs/integrations	Documentation tree.
5724	docs/loop	Documentation tree.
4649614	docs/migration-review	Documentation tree.
3747	docs/operating	Documentation tree.
14950	docs/pen	Documentation tree.
4783	docs/source-notes	Documentation tree.
0	docs/superpowers	Documentation tree.
7318	docs/superpowers/specs	Documentation tree.
1456	docs/tessera-control	Documentation tree.
102923	docs/v2	Documentation tree.
784	docs/v2/offline	Documentation tree.
2410	docs/v2/protocol	Documentation tree.
78680	docs/v3	Documentation tree.
0	evals	Repository directory.
19794	evals/heldout	Repository directory.
101513	evals/heldout/retrieval	Repository directory.
16504	gate	Suite tooling.
24270	identity	Repository directory.
0	lib	Shared workspace library tree.
22811	lib/api-client-react	Shared workspace library tree.
11571	lib/api-client-react/src	Shared workspace library tree.
2722	lib/api-client-react/src/generated	Shared workspace library tree.
2779	lib/api-spec	Shared workspace library tree.
16547	lib/api-zod	Shared workspace library tree.
68	lib/api-zod/src	Shared workspace library tree.
296	lib/api-zod/src/generated	Shared workspace library tree.
338	lib/api-zod/src/generated/types	Shared workspace library tree.
149592	lib/db	Shared workspace library tree.
28908	lib/db/drizzle	Shared workspace library tree.
213110	lib/db/drizzle/meta	Shared workspace library tree.
1322	lib/db/sql	Shared workspace library tree.
2706	lib/db/src	Shared workspace library tree.
76760	lib/db/src/schema	Shared workspace library tree.
465	mesh	Repository directory.
4372	mesh/queue	Repository directory.
7207	preview	Repository directory.
1103	preview/public	Repository directory.
58078	preview/public/fonts	Repository directory.
3151	preview/scripts	Repository directory.
9196	preview/src	Repository directory.
668	preview/src/components	Repository directory.
215536	preview/src/components/tessera	Repository directory.
23598	preview/src/lib	Repository directory.
39006	preview/src/lib/app-data	Repository directory.
87675	preview/src/lib/auth	Repository directory.
14631	preview/src/lib/mesh-node	Repository directory.
21720	preview/src/lib/multiplayer	Repository directory.
4045	preview/src/lib/offline	Repository directory.
66	preview/src/lib/og	Repository directory.
9855	preview/src/lib/secure-mesh	Repository directory.
2513379	preview/src/lib/tessera	Repository directory.
1841	preview/src/routes	Repository directory.
0	preview/src/routes/api	Repository directory.
622	preview/src/routes/api/tessera	Repository directory.
0	research	Repository directory.
2565	research/mesh-moltbook	Repository directory.
29211	research/mesh-moltbook/src	Repository directory.
13872	research/mesh-moltbook/test	Repository directory.
17306	research/own-brain	Repository directory.
188346	scripts	Suite tooling.
6458	scripts/eval	Suite tooling.
11333	scripts/feedback	Suite tooling.
2575	scripts/fixtures	Suite tooling.
31223	scripts/loop	Suite tooling.
40997	scripts/scorecard	Suite tooling.
3757	scripts/scorecard/fixtures	Suite tooling.
45204	scripts/selfbuild	Suite tooling.
504	scripts/selfbuild/fixtures	Suite tooling.
46	scripts/src	Suite tooling.
0	tools	Suite tooling.
3083	tools/bench	Suite tooling.
36809	tools/deltabundle	Suite tooling.
39634	tools/etagcache	Suite tooling.
34069	tools/pregate	Suite tooling.
```

## File list

```
bytes	kind	status	read	path	purpose
447	file	docs	not-opened	.agents/memory/MEMORY.md	Agent skill or memory note. Contents not read.
464	file	docs	not-opened	.agents/memory/agent-identity-boundary.md	Agent skill or memory note. Contents not read.
565	file	docs	not-opened	.agents/memory/github-repo-tree-snapshots.md	Agent skill or memory note. Contents not read.
750	file	docs	not-opened	.agents/memory/outbound-knowledge-sources.md	Agent skill or memory note. Contents not read.
6107	file	docs	not-opened	.agents/skills/agent-tools/SKILL.md	Agent skill or memory note. Contents not read.
2120	file	docs	not-opened	.agents/skills/agent-tools/references/app-discovery.md	Agent skill or memory note. Contents not read.
1084	file	docs	not-opened	.agents/skills/agent-tools/references/authentication.md	Agent skill or memory note. Contents not read.
3181	file	docs	not-opened	.agents/skills/agent-tools/references/cli-reference.md	Agent skill or memory note. Contents not read.
3705	file	docs	not-opened	.agents/skills/agent-tools/references/running-apps.md	Agent skill or memory note. Contents not read.
1146	file	docs	not-opened	.agents/skills/audit-website/README.md	Agent skill or memory note. Contents not read.
17058	file	docs	not-opened	.agents/skills/audit-website/SKILL.md	Agent skill or memory note. Contents not read.
229	file	docs	not-opened	.agents/skills/audit-website/agents/openai.yaml	Agent skill or memory note. Contents not read.
2763	file	docs	not-opened	.agents/skills/audit-website/assets/icon-large.png	Agent skill or memory note. Contents not read.
1721	file	docs	not-opened	.agents/skills/audit-website/assets/icon-small.svg	Agent skill or memory note. Contents not read.
7706	file	docs	not-opened	.agents/skills/audit-website/references/OUTPUT-FORMAT.md	Agent skill or memory note. Contents not read.
6524	file	docs	not-opened	.agents/skills/better-auth-best-practices/SKILL.md	Agent skill or memory note. Contents not read.
10634	file	docs	not-opened	.agents/skills/brainstorming/SKILL.md	Agent skill or memory note. Contents not read.
7703	file	docs	not-opened	.agents/skills/brainstorming/scripts/frame-template.html	Agent skill or memory note. Contents not read.
2707	file	docs	not-opened	.agents/skills/brainstorming/scripts/helper.js	Agent skill or memory note. Contents not read.
11218	file	docs	not-opened	.agents/skills/brainstorming/scripts/server.cjs	Agent skill or memory note. Contents not read.
4606	file	docs	not-opened	.agents/skills/brainstorming/scripts/start-server.sh	Agent skill or memory note. Contents not read.
1314	file	docs	not-opened	.agents/skills/brainstorming/scripts/stop-server.sh	Agent skill or memory note. Contents not read.
1748	file	docs	not-opened	.agents/skills/brainstorming/spec-document-reviewer-prompt.md	Agent skill or memory note. Contents not read.
12047	file	docs	not-opened	.agents/skills/brainstorming/visual-companion.md	Agent skill or memory note. Contents not read.
9587	file	docs	not-opened	.agents/skills/browser-use/SKILL.md	Agent skill or memory note. Contents not read.
3621	file	docs	not-opened	.agents/skills/browser-use/references/cdp-python.md	Agent skill or memory note. Contents not read.
2846	file	docs	not-opened	.agents/skills/browser-use/references/multi-session.md	Agent skill or memory note. Contents not read.
7533	file	docs	not-opened	.agents/skills/copywriting/SKILL.md	Agent skill or memory note. Contents not read.
8158	file	docs	not-opened	.agents/skills/copywriting/evals/evals.json	Agent skill or memory note. Contents not read.
7887	file	docs	not-opened	.agents/skills/copywriting/references/copy-frameworks.md	Agent skill or memory note. Contents not read.
5684	file	docs	not-opened	.agents/skills/copywriting/references/natural-transitions.md	Agent skill or memory note. Contents not read.
5446	file	docs	not-opened	.agents/skills/find-skills/SKILL.md	Agent skill or memory note. Contents not read.
10174	file	docs	not-opened	.agents/skills/frontend-design/LICENSE.txt	Agent skill or memory note. Contents not read.
4440	file	docs	not-opened	.agents/skills/frontend-design/SKILL.md	Agent skill or memory note. Contents not read.
4004	file	docs	not-opened	.agents/skills/next-best-practices/SKILL.md	Agent skill or memory note. Contents not read.
1664	file	docs	not-opened	.agents/skills/next-best-practices/async-patterns.md	Agent skill or memory note. Contents not read.
4456	file	docs	not-opened	.agents/skills/next-best-practices/bundling.md	Agent skill or memory note. Contents not read.
6687	file	docs	not-opened	.agents/skills/next-best-practices/data-patterns.md	Agent skill or memory note. Contents not read.
2953	file	docs	not-opened	.agents/skills/next-best-practices/debug-tricks.md	Agent skill or memory note. Contents not read.
1476	file	docs	not-opened	.agents/skills/next-best-practices/directives.md	Agent skill or memory note. Contents not read.
4736	file	docs	not-opened	.agents/skills/next-best-practices/error-handling.md	Agent skill or memory note. Contents not read.
3464	file	docs	not-opened	.agents/skills/next-best-practices/file-conventions.md	Agent skill or memory note. Contents not read.
5196	file	docs	not-opened	.agents/skills/next-best-practices/font.md	Agent skill or memory note. Contents not read.
4388	file	docs	not-opened	.agents/skills/next-best-practices/functions.md	Agent skill or memory note. Contents not read.
1801	file	docs	not-opened	.agents/skills/next-best-practices/hydration-error.md	Agent skill or memory note. Contents not read.
3882	file	docs	not-opened	.agents/skills/next-best-practices/image.md	Agent skill or memory note. Contents not read.
7140	file	docs	not-opened	.agents/skills/next-best-practices/metadata.md	Agent skill or memory note. Contents not read.
7171	file	docs	not-opened	.agents/skills/next-best-practices/parallel-routes.md	Agent skill or memory note. Contents not read.
3244	file	docs	not-opened	.agents/skills/next-best-practices/route-handlers.md	Agent skill or memory note. Contents not read.
4309	file	docs	not-opened	.agents/skills/next-best-practices/rsc-boundaries.md	Agent skill or memory note. Contents not read.
985	file	docs	not-opened	.agents/skills/next-best-practices/runtime-selection.md	Agent skill or memory note. Contents not read.
3326	file	docs	not-opened	.agents/skills/next-best-practices/scripts.md	Agent skill or memory note. Contents not read.
8334	file	docs	not-opened	.agents/skills/next-best-practices/self-hosting.md	Agent skill or memory note. Contents not read.
1366	file	docs	not-opened	.agents/skills/next-best-practices/suspense-boundaries.md	Agent skill or memory note. Contents not read.
1467	file	docs	not-opened	.agents/skills/pdf/LICENSE.txt	Agent skill or memory note. Contents not read.
8072	file	docs	not-opened	.agents/skills/pdf/SKILL.md	Agent skill or memory note. Contents not read.
11854	file	docs	not-opened	.agents/skills/pdf/forms.md	Agent skill or memory note. Contents not read.
16692	file	docs	not-opened	.agents/skills/pdf/reference.md	Agent skill or memory note. Contents not read.
2774	file	docs	not-opened	.agents/skills/pdf/scripts/check_bounding_boxes.py	Agent skill or memory note. Contents not read.
268	file	docs	not-opened	.agents/skills/pdf/scripts/check_fillable_fields.py	Agent skill or memory note. Contents not read.
1008	file	docs	not-opened	.agents/skills/pdf/scripts/convert_pdf_to_images.py	Agent skill or memory note. Contents not read.
1258	file	docs	not-opened	.agents/skills/pdf/scripts/create_validation_image.py	Agent skill or memory note. Contents not read.
4300	file	docs	not-opened	.agents/skills/pdf/scripts/extract_form_field_info.py	Agent skill or memory note. Contents not read.
3945	file	docs	not-opened	.agents/skills/pdf/scripts/extract_form_structure.py	Agent skill or memory note. Contents not read.
3819	file	docs	not-opened	.agents/skills/pdf/scripts/fill_fillable_fields.py	Agent skill or memory note. Contents not read.
3235	file	docs	not-opened	.agents/skills/pdf/scripts/fill_pdf_form_with_annotations.py	Agent skill or memory note. Contents not read.
1467	file	duplicate	not-opened	.agents/skills/pptx/LICENSE.txt	Byte-identical to `.agents/skills/pdf/LICENSE.txt`. Agent skill or memory note. Contents not read.
9182	file	docs	not-opened	.agents/skills/pptx/SKILL.md	Agent skill or memory note. Contents not read.
6885	file	docs	not-opened	.agents/skills/pptx/editing.md	Agent skill or memory note. Contents not read.
12819	file	docs	not-opened	.agents/skills/pptx/pptxgenjs.md	Agent skill or memory note. Contents not read.
0	file	docs	not-opened	.agents/skills/pptx/scripts/__init__.py	Agent skill or memory note. Contents not read.
6872	file	docs	not-opened	.agents/skills/pptx/scripts/add_slide.py	Agent skill or memory note. Contents not read.
9583	file	docs	not-opened	.agents/skills/pptx/scripts/clean.py	Agent skill or memory note. Contents not read.
0	file	duplicate	not-opened	.agents/skills/pptx/scripts/office/helpers/__init__.py	Byte-identical to `.agents/skills/pptx/scripts/__init__.py`. Agent skill or memory note. Contents not read.
5567	file	docs	not-opened	.agents/skills/pptx/scripts/office/helpers/merge_runs.py	Agent skill or memory note. Contents not read.
5754	file	docs	not-opened	.agents/skills/pptx/scripts/office/helpers/simplify_redlines.py	Agent skill or memory note. Contents not read.
4991	file	docs	not-opened	.agents/skills/pptx/scripts/office/pack.py	Agent skill or memory note. Contents not read.
74984	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-chart.xsd	Agent skill or memory note. Contents not read.
6956	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-chartDrawing.xsd	Agent skill or memory note. Contents not read.
51302	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-diagram.xsd	Agent skill or memory note. Contents not read.
624	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-lockedCanvas.xsd	Agent skill or memory note. Contents not read.
152039	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-main.xsd	Agent skill or memory note. Contents not read.
1231	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-picture.xsd	Agent skill or memory note. Contents not read.
8862	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-spreadsheetDrawing.xsd	Agent skill or memory note. Contents not read.
14795	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-wordprocessingDrawing.xsd	Agent skill or memory note. Contents not read.
83612	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/pml.xsd	Agent skill or memory note. Contents not read.
1269	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-additionalCharacteristics.xsd	Agent skill or memory note. Contents not read.
7328	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-bibliography.xsd	Agent skill or memory note. Contents not read.
6382	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-commonSimpleTypes.xsd	Agent skill or memory note. Contents not read.
1248	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-customXmlDataProperties.xsd	Agent skill or memory note. Contents not read.
880	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-customXmlSchemaProperties.xsd	Agent skill or memory note. Contents not read.
2608	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-documentPropertiesCustom.xsd	Agent skill or memory note. Contents not read.
3507	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-documentPropertiesExtended.xsd	Agent skill or memory note. Contents not read.
7507	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-documentPropertiesVariantTypes.xsd	Agent skill or memory note. Contents not read.
23313	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-math.xsd	Agent skill or memory note. Contents not read.
1367	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-relationshipReference.xsd	Agent skill or memory note. Contents not read.
242277	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/sml.xsd	Agent skill or memory note. Contents not read.
26148	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/vml-main.xsd	Agent skill or memory note. Contents not read.
25279	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/vml-officeDrawing.xsd	Agent skill or memory note. Contents not read.
535	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/vml-presentationDrawing.xsd	Agent skill or memory note. Contents not read.
5712	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/vml-spreadsheetDrawing.xsd	Agent skill or memory note. Contents not read.
4010	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/vml-wordprocessingDrawing.xsd	Agent skill or memory note. Contents not read.
171367	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/wml.xsd	Agent skill or memory note. Contents not read.
4646	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/xml.xsd	Agent skill or memory note. Contents not read.
1963	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ecma/fouth-edition/opc-contentTypes.xsd	Agent skill or memory note. Contents not read.
2515	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ecma/fouth-edition/opc-coreProperties.xsd	Agent skill or memory note. Contents not read.
2856	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ecma/fouth-edition/opc-digSig.xsd	Agent skill or memory note. Contents not read.
1344	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/ecma/fouth-edition/opc-relationships.xsd	Agent skill or memory note. Contents not read.
3127	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/mce/mc.xsd	Agent skill or memory note. Contents not read.
26549	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/microsoft/wml-2010.xsd	Agent skill or memory note. Contents not read.
3745	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/microsoft/wml-2012.xsd	Agent skill or memory note. Contents not read.
901	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/microsoft/wml-2018.xsd	Agent skill or memory note. Contents not read.
1778	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/microsoft/wml-cex-2018.xsd	Agent skill or memory note. Contents not read.
1002	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/microsoft/wml-cid-2016.xsd	Agent skill or memory note. Contents not read.
600	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/microsoft/wml-sdtdatahash-2020.xsd	Agent skill or memory note. Contents not read.
745	file	docs	not-opened	.agents/skills/pptx/scripts/office/schemas/microsoft/wml-symex-2015.xsd	Agent skill or memory note. Contents not read.
5301	file	docs	not-opened	.agents/skills/pptx/scripts/office/soffice.py	Agent skill or memory note. Contents not read.
4052	file	docs	not-opened	.agents/skills/pptx/scripts/office/unpack.py	Agent skill or memory note. Contents not read.
3668	file	docs	not-opened	.agents/skills/pptx/scripts/office/validate.py	Agent skill or memory note. Contents not read.
336	file	docs	not-opened	.agents/skills/pptx/scripts/office/validators/__init__.py	Agent skill or memory note. Contents not read.
32651	file	docs	not-opened	.agents/skills/pptx/scripts/office/validators/base.py	Agent skill or memory note. Contents not read.
16376	file	docs	not-opened	.agents/skills/pptx/scripts/office/validators/docx.py	Agent skill or memory note. Contents not read.
9824	file	docs	not-opened	.agents/skills/pptx/scripts/office/validators/pptx.py	Agent skill or memory note. Contents not read.
8918	file	docs	not-opened	.agents/skills/pptx/scripts/office/validators/redlining.py	Agent skill or memory note. Contents not read.
8785	file	docs	not-opened	.agents/skills/pptx/scripts/thumbnail.py	Agent skill or memory note. Contents not read.
5235	file	docs	not-opened	.agents/skills/remotion-best-practices/SKILL.md	Agent skill or memory note. Contents not read.
2292	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/3d.md	Agent skill or memory note. Contents not read.
1089	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/animations.md	Agent skill or memory note. Contents not read.
1604	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/assets.md	Agent skill or memory note. Contents not read.
3429	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/assets/charts-bar-chart.tsx	Agent skill or memory note. Contents not read.
2183	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/assets/text-animations-typewriter.tsx	Agent skill or memory note. Contents not read.
2380	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/assets/text-animations-word-highlight.tsx	Agent skill or memory note. Contents not read.
4892	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/audio-visualization.md	Agent skill or memory note. Contents not read.
3625	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/audio.md	Agent skill or memory note. Contents not read.
3254	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/calculate-metadata.md	Agent skill or memory note. Contents not read.
1677	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/can-decode.md	Agent skill or memory note. Contents not read.
2942	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/charts.md	Agent skill or memory note. Contents not read.
3794	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/compositions.md	Agent skill or memory note. Contents not read.
5471	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/display-captions.md	Agent skill or memory note. Contents not read.
5499	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/extract-frames.md	Agent skill or memory note. Contents not read.
1093	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/ffmpeg.md	Agent skill or memory note. Contents not read.
3484	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/fonts.md	Agent skill or memory note. Contents not read.
1357	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/get-audio-duration.md	Agent skill or memory note. Contents not read.
1626	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/get-video-dimensions.md	Agent skill or memory note. Contents not read.
1377	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/get-video-duration.md	Agent skill or memory note. Contents not read.
3707	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/gifs.md	Agent skill or memory note. Contents not read.
2791	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/images.md	Agent skill or memory note. Contents not read.
2247	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/import-srt-captions.md	Agent skill or memory note. Contents not read.
2305	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/light-leaks.md	Agent skill or memory note. Contents not read.
1796	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/lottie.md	Agent skill or memory note. Contents not read.
11300	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/maps.md	Agent skill or memory note. Contents not read.
973	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/measuring-dom-nodes.md	Agent skill or memory note. Contents not read.
2783	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/measuring-text.md	Agent skill or memory note. Contents not read.
2387	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/parameters.md	Agent skill or memory note. Contents not read.
2746	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/sequencing.md	Agent skill or memory note. Contents not read.
867	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/sfx.md	Agent skill or memory note. Contents not read.
2548	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/silence-detection.md	Agent skill or memory note. Contents not read.
922	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/subtitles.md	Agent skill or memory note. Contents not read.
420	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/tailwind.md	Agent skill or memory note. Contents not read.
700	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/text-animations.md	Agent skill or memory note. Contents not read.
4470	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/timing.md	Agent skill or memory note. Contents not read.
1897	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/transcribe-captions.md	Agent skill or memory note. Contents not read.
5816	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/transitions.md	Agent skill or memory note. Contents not read.
2267	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/transparent-videos.md	Agent skill or memory note. Contents not read.
1209	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/trimming.md	Agent skill or memory note. Contents not read.
3509	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/videos.md	Agent skill or memory note. Contents not read.
3318	file	docs	not-opened	.agents/skills/remotion-best-practices/rules/voiceover.md	Agent skill or memory note. Contents not read.
10723	file	docs	not-opened	.agents/skills/seo-audit/SKILL.md	Agent skill or memory note. Contents not read.
9833	file	docs	not-opened	.agents/skills/seo-audit/evals/evals.json	Agent skill or memory note. Contents not read.
6528	file	docs	not-opened	.agents/skills/seo-audit/references/ai-writing-detection.md	Agent skill or memory note. Contents not read.
2576	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/SKILL.md	Agent skill or memory note. Contents not read.
4117	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/_contributing.md	Agent skill or memory note. Contents not read.
1682	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/_sections.md	Agent skill or memory note. Contents not read.
1040	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/_template.md	Agent skill or memory note. Contents not read.
1468	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md	Agent skill or memory note. Contents not read.
1444	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md	Agent skill or memory note. Contents not read.
1282	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md	Agent skill or memory note. Contents not read.
1325	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/conn-limits.md	Agent skill or memory note. Contents not read.
1382	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/conn-pooling.md	Agent skill or memory note. Contents not read.
1529	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md	Agent skill or memory note. Contents not read.
1287	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/data-batch-inserts.md	Agent skill or memory note. Contents not read.
1361	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md	Agent skill or memory note. Contents not read.
1358	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/data-pagination.md	Agent skill or memory note. Contents not read.
1390	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/data-upsert.md	Agent skill or memory note. Contents not read.
1531	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/lock-advisory.md	Agent skill or memory note. Contents not read.
1855	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md	Agent skill or memory note. Contents not read.
1350	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/lock-short-transactions.md	Agent skill or memory note. Contents not read.
1353	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/lock-skip-locked.md	Agent skill or memory note. Contents not read.
1441	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md	Agent skill or memory note. Contents not read.
1418	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md	Agent skill or memory note. Contents not read.
1506	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md	Agent skill or memory note. Contents not read.
1454	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/query-composite-indexes.md	Agent skill or memory note. Contents not read.
1287	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/query-covering-indexes.md	Agent skill or memory note. Contents not read.
1521	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/query-index-types.md	Agent skill or memory note. Contents not read.
1218	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/query-missing-indexes.md	Agent skill or memory note. Contents not read.
1347	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/query-partial-indexes.md	Agent skill or memory note. Contents not read.
1880	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/schema-constraints.md	Agent skill or memory note. Contents not read.
1453	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/schema-data-types.md	Agent skill or memory note. Contents not read.
1679	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md	Agent skill or memory note. Contents not read.
1728	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md	Agent skill or memory note. Contents not read.
1548	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/schema-partitioning.md	Agent skill or memory note. Contents not read.
1821	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/schema-primary-keys.md	Agent skill or memory note. Contents not read.
1566	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/security-privileges.md	Agent skill or memory note. Contents not read.
1372	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/security-rls-basics.md	Agent skill or memory note. Contents not read.
1493	file	docs	not-opened	.agents/skills/supabase-postgres-best-practices/references/security-rls-performance.md	Agent skill or memory note. Contents not read.
44776	file	docs	not-opened	.agents/skills/ui-ux-pro-max/SKILL.md	Agent skill or memory note. Contents not read.
21832	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/_sync_all.py	Agent skill or memory note. Contents not read.
9743	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/app-interface.csv	Agent skill or memory note. Contents not read.
19391	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/charts.csv	Agent skill or memory note. Contents not read.
32432	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/colors.csv	Agent skill or memory note. Contents not read.
106144	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/design.csv	Agent skill or memory note. Contents not read.
106266	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/draft.csv	Agent skill or memory note. Contents not read.
745196	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/google-fonts.csv	Agent skill or memory note. Contents not read.
20637	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/icons.csv	Agent skill or memory note. Contents not read.
16720	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/landing.csv	Agent skill or memory note. Contents not read.
58006	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/products.csv	Agent skill or memory note. Contents not read.
14822	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/react-performance.csv	Agent skill or memory note. Contents not read.
18269	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/angular.csv	Agent skill or memory note. Contents not read.
11868	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/astro.csv	Agent skill or memory note. Contents not read.
10416	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/flutter.csv	Agent skill or memory note. Contents not read.
11305	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/html-tailwind.csv	Agent skill or memory note. Contents not read.
8195	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/jetpack-compose.csv	Agent skill or memory note. Contents not read.
18378	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/laravel.csv	Agent skill or memory note. Contents not read.
12493	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/nextjs.csv	Agent skill or memory note. Contents not read.
14010	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/nuxt-ui.csv	Agent skill or memory note. Contents not read.
16539	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/nuxtjs.csv	Agent skill or memory note. Contents not read.
10035	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/react-native.csv	Agent skill or memory note. Contents not read.
12962	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/react.csv	Agent skill or memory note. Contents not read.
15921	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/shadcn.csv	Agent skill or memory note. Contents not read.
11009	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/svelte.csv	Agent skill or memory note. Contents not read.
10821	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/swiftui.csv	Agent skill or memory note. Contents not read.
44787	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/threejs.csv	Agent skill or memory note. Contents not read.
11006	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/stacks/vue.csv	Agent skill or memory note. Contents not read.
142673	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/styles.csv	Agent skill or memory note. Contents not read.
49667	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/typography.csv	Agent skill or memory note. Contents not read.
53070	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/ui-reasoning.csv	Agent skill or memory note. Contents not read.
18766	file	docs	not-opened	.agents/skills/ui-ux-pro-max/data/ux-guidelines.csv	Agent skill or memory note. Contents not read.
12393	file	docs	not-opened	.agents/skills/ui-ux-pro-max/scripts/core.py	Agent skill or memory note. Contents not read.
47070	file	docs	not-opened	.agents/skills/ui-ux-pro-max/scripts/design_system.py	Agent skill or memory note. Contents not read.
5607	file	docs	not-opened	.agents/skills/ui-ux-pro-max/scripts/search.py	Agent skill or memory note. Contents not read.
22627	file	docs	not-opened	.agents/skills/vercel-composition-patterns/AGENTS.md	Agent skill or memory note. Contents not read.
2140	file	docs	not-opened	.agents/skills/vercel-composition-patterns/README.md	Agent skill or memory note. Contents not read.
2886	file	docs	not-opened	.agents/skills/vercel-composition-patterns/SKILL.md	Agent skill or memory note. Contents not read.
530	file	docs	not-opened	.agents/skills/vercel-composition-patterns/metadata.json	Agent skill or memory note. Contents not read.
829	file	docs	not-opened	.agents/skills/vercel-composition-patterns/rules/_sections.md	Agent skill or memory note. Contents not read.
329	file	docs	not-opened	.agents/skills/vercel-composition-patterns/rules/_template.md	Agent skill or memory note. Contents not read.
2267	file	docs	not-opened	.agents/skills/vercel-composition-patterns/rules/architecture-avoid-boolean-props.md	Agent skill or memory note. Contents not read.
2600	file	docs	not-opened	.agents/skills/vercel-composition-patterns/rules/architecture-compound-components.md	Agent skill or memory note. Contents not read.
1886	file	docs	not-opened	.agents/skills/vercel-composition-patterns/rules/patterns-children-over-render-props.md	Agent skill or memory note. Contents not read.
2395	file	docs	not-opened	.agents/skills/vercel-composition-patterns/rules/patterns-explicit-variants.md	Agent skill or memory note. Contents not read.
953	file	docs	not-opened	.agents/skills/vercel-composition-patterns/rules/react19-no-forwardref.md	Agent skill or memory note. Contents not read.
4974	file	docs	not-opened	.agents/skills/vercel-composition-patterns/rules/state-context-interface.md	Agent skill or memory note. Contents not read.
2699	file	docs	not-opened	.agents/skills/vercel-composition-patterns/rules/state-decouple-implementation.md	Agent skill or memory note. Contents not read.
3224	file	docs	not-opened	.agents/skills/vercel-composition-patterns/rules/state-lift-state.md	Agent skill or memory note. Contents not read.
105774	file	docs	not-opened	.agents/skills/vercel-react-best-practices/AGENTS.md	Agent skill or memory note. Contents not read.
3360	file	docs	not-opened	.agents/skills/vercel-react-best-practices/README.md	Agent skill or memory note. Contents not read.
7129	file	docs	not-opened	.agents/skills/vercel-react-best-practices/SKILL.md	Agent skill or memory note. Contents not read.
921	file	docs	not-opened	.agents/skills/vercel-react-best-practices/metadata.json	Agent skill or memory note. Contents not read.
1554	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/_sections.md	Agent skill or memory note. Contents not read.
631	file	duplicate	not-opened	.agents/skills/vercel-react-best-practices/rules/_template.md	Byte-identical to `.agents/skills/vercel-react-native-skills/rules/_template.md`. Agent skill or memory note. Contents not read.
1802	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/advanced-effect-event-deps.md	Agent skill or memory note. Contents not read.
1483	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/advanced-event-handler-refs.md	Agent skill or memory note. Contents not read.
958	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/advanced-init-once.md	Agent skill or memory note. Contents not read.
1072	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/advanced-use-latest.md	Agent skill or memory note. Contents not read.
1125	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/async-api-routes.md	Agent skill or memory note. Contents not read.
1220	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/async-cheap-condition-before-await.md	Agent skill or memory note. Contents not read.
2208	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/async-defer-await.md	Agent skill or memory note. Contents not read.
1293	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/async-dependencies.md	Agent skill or memory note. Contents not read.
654	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/async-parallel.md	Agent skill or memory note. Contents not read.
2510	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/async-suspense-boundaries.md	Agent skill or memory note. Contents not read.
2795	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/bundle-barrel-imports.md	Agent skill or memory note. Contents not read.
949	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/bundle-conditional.md	Agent skill or memory note. Contents not read.
920	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/bundle-defer-third-party.md	Agent skill or memory note. Contents not read.
791	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/bundle-dynamic-imports.md	Agent skill or memory note. Contents not read.
1149	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/bundle-preload.md	Agent skill or memory note. Contents not read.
1969	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/client-event-listeners.md	Agent skill or memory note. Contents not read.
1950	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/client-localstorage-schema.md	Agent skill or memory note. Contents not read.
1644	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/client-passive-event-listeners.md	Agent skill or memory note. Contents not read.
1159	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/client-swr-dedup.md	Agent skill or memory note. Contents not read.
3266	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-batch-dom-css.md	Agent skill or memory note. Contents not read.
1949	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-cache-function-results.md	Agent skill or memory note. Contents not read.
532	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-cache-property-access.md	Agent skill or memory note. Contents not read.
1651	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-cache-storage.md	Agent skill or memory note. Contents not read.
753	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-combine-iterations.md	Agent skill or memory note. Contents not read.
1133	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-early-exit.md	Agent skill or memory note. Contents not read.
1411	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-flatmap-filter.md	Agent skill or memory note. Contents not read.
1028	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-hoist-regexp.md	Agent skill or memory note. Contents not read.
837	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-index-maps.md	Agent skill or memory note. Contents not read.
1747	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-length-check-first.md	Agent skill or memory note. Contents not read.
2290	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-min-max-loop.md	Agent skill or memory note. Contents not read.
2647	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-request-idle-callback.md	Agent skill or memory note. Contents not read.
532	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-set-map-lookups.md	Agent skill or memory note. Contents not read.
1782	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/js-tosorted-immutable.md	Agent skill or memory note. Contents not read.
564	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-activity.md	Agent skill or memory note. Contents not read.
1185	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-animate-svg-wrapper.md	Agent skill or memory note. Contents not read.
980	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-conditional-render.md	Agent skill or memory note. Contents not read.
815	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-content-visibility.md	Agent skill or memory note. Contents not read.
1039	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-hoist-jsx.md	Agent skill or memory note. Contents not read.
2308	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-hydration-no-flicker.md	Agent skill or memory note. Contents not read.
872	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-hydration-suppress-warning.md	Agent skill or memory note. Contents not read.
2549	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-resource-hints.md	Agent skill or memory note. Contents not read.
1868	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-script-defer-async.md	Agent skill or memory note. Contents not read.
588	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-svg-precision.md	Agent skill or memory note. Contents not read.
2074	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rendering-usetransition-loading.md	Agent skill or memory note. Contents not read.
973	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-defer-reads.md	Agent skill or memory note. Contents not read.
824	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-dependencies.md	Agent skill or memory note. Contents not read.
1201	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-derived-state-no-effect.md	Agent skill or memory note. Contents not read.
728	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-derived-state.md	Agent skill or memory note. Contents not read.
2968	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-functional-setstate.md	Agent skill or memory note. Contents not read.
2016	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-lazy-state-init.md	Agent skill or memory note. Contents not read.
1173	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-memo-with-default-value.md	Agent skill or memory note. Contents not read.
1148	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-memo.md	Agent skill or memory note. Contents not read.
1268	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-move-effect-to-event.md	Agent skill or memory note. Contents not read.
2135	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-no-inline-components.md	Agent skill or memory note. Contents not read.
1018	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-simple-expression-in-memo.md	Agent skill or memory note. Contents not read.
1844	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-split-combined-hooks.md	Agent skill or memory note. Contents not read.
1055	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-transitions.md	Agent skill or memory note. Contents not read.
1846	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-use-deferred-value.md	Agent skill or memory note. Contents not read.
1742	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/rerender-use-ref-transient-values.md	Agent skill or memory note. Contents not read.
2012	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/server-after-nonblocking.md	Agent skill or memory note. Contents not read.
2649	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/server-auth-actions.md	Agent skill or memory note. Contents not read.
1353	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/server-cache-lru.md	Agent skill or memory note. Contents not read.
2228	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/server-cache-react.md	Agent skill or memory note. Contents not read.
2060	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/server-dedup-props.md	Agent skill or memory note. Contents not read.
4423	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/server-hoist-static-io.md	Agent skill or memory note. Contents not read.
1766	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/server-no-shared-module-state.md	Agent skill or memory note. Contents not read.
1554	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/server-parallel-fetching.md	Agent skill or memory note. Contents not read.
992	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/server-parallel-nested-fetching.md	Agent skill or memory note. Contents not read.
996	file	docs	not-opened	.agents/skills/vercel-react-best-practices/rules/server-serialization.md	Agent skill or memory note. Contents not read.
73771	file	docs	not-opened	.agents/skills/vercel-react-native-skills/AGENTS.md	Agent skill or memory note. Contents not read.
5064	file	docs	not-opened	.agents/skills/vercel-react-native-skills/README.md	Agent skill or memory note. Contents not read.
4439	file	docs	not-opened	.agents/skills/vercel-react-native-skills/SKILL.md	Agent skill or memory note. Contents not read.
896	file	docs	not-opened	.agents/skills/vercel-react-native-skills/metadata.json	Agent skill or memory note. Contents not read.
2228	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/_sections.md	Agent skill or memory note. Contents not read.
631	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/_template.md	Agent skill or memory note. Contents not read.
1373	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/animation-derived-value.md	Agent skill or memory note. Contents not read.
2559	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/animation-gesture-detector-press.md	Agent skill or memory note. Contents not read.
2059	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/animation-gpu-properties.md	Agent skill or memory note. Contents not read.
1625	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/design-system-compound-components.md	Agent skill or memory note. Contents not read.
1393	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/fonts-config-plugin.md	Agent skill or memory note. Contents not read.
1418	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/imports-design-system-folder.md	Agent skill or memory note. Contents not read.
1645	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/js-hoist-intl.md	Agent skill or memory note. Contents not read.
1059	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/list-performance-callbacks.md	Agent skill or memory note. Contents not read.
4133	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/list-performance-function-references.md	Agent skill or memory note. Contents not read.
1417	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/list-performance-images.md	Agent skill or memory note. Contents not read.
2308	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/list-performance-inline-objects.md	Agent skill or memory note. Contents not read.
2466	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/list-performance-item-expensive.md	Agent skill or memory note. Contents not read.
2250	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/list-performance-item-memo.md	Agent skill or memory note. Contents not read.
2749	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/list-performance-item-types.md	Agent skill or memory note. Contents not read.
1742	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/list-performance-virtualize.md	Agent skill or memory note. Contents not read.
1091	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/monorepo-native-deps-in-app.md	Agent skill or memory note. Contents not read.
1351	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/monorepo-single-dependency-versions.md	Agent skill or memory note. Contents not read.
4941	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/navigation-native-navigators.md	Agent skill or memory note. Contents not read.
1274	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/react-compiler-destructure-functions.md	Agent skill or memory note. Contents not read.
1268	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/react-compiler-reanimated-shared-values.md	Agent skill or memory note. Contents not read.
2255	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/react-state-dispatcher.md	Agent skill or memory note. Contents not read.
1735	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/react-state-fallback.md	Agent skill or memory note. Contents not read.
1740	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/react-state-minimize.md	Agent skill or memory note. Contents not read.
1812	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/rendering-no-falsy-and.md	Agent skill or memory note. Contents not read.
697	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/rendering-text-in-text-component.md	Agent skill or memory note. Contents not read.
1936	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/scroll-position-no-state.md	Agent skill or memory note. Contents not read.
2172	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/state-ground-truth.md	Agent skill or memory note. Contents not read.
1648	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/ui-expo-image.md	Agent skill or memory note. Contents not read.
2546	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/ui-image-gallery.md	Agent skill or memory note. Contents not read.
2232	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/ui-measure-views.md	Agent skill or memory note. Contents not read.
4598	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/ui-menus.md	Agent skill or memory note. Contents not read.
1859	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/ui-native-modals.md	Agent skill or memory note. Contents not read.
1534	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/ui-pressable.md	Agent skill or memory note. Contents not read.
1579	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/ui-safe-area-scroll.md	Agent skill or memory note. Contents not read.
1317	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/ui-scrollview-content-inset.md	Agent skill or memory note. Contents not read.
2212	file	docs	not-opened	.agents/skills/vercel-react-native-skills/rules/ui-styling.md	Agent skill or memory note. Contents not read.
1231	file	docs	not-opened	.agents/skills/web-design-guidelines/SKILL.md	Agent skill or memory note. Contents not read.
120	file	live code	not-opened	.codebase-memory/.gitattributes	Repository file. Contents not read.
369	file	live code	opened	.codebase-memory/artifact.json	Index metadata only: schema 2, commit da56a24, 23879 nodes. Graph was not queried.
143	file	live code	not-opened	.cursor/environment.json	Repository file. Contents not read.
498	file	live code	not-opened	.cursor/setup	Repository file. Contents not read.
3015	file	live code	not-opened	.env.example	Repository file. Contents not read.
521	file	live code	not-opened	.gitattributes	Repository file. Contents not read.
1146	file	live code	not-opened	.github/CODEOWNERS	GitHub workflow or ownership file. Contents not read.
513	file	live code	not-opened	.github/dependabot.yml	GitHub workflow or ownership file. Contents not read.
3009	file	live code	not-opened	.github/workflows/ci.yml	GitHub workflow or ownership file. Contents not read.
896	file	live code	not-opened	.github/workflows/main-provenance.yml	GitHub workflow or ownership file. Contents not read.
2062	file	live code	not-opened	.github/workflows/meta-loop.yml	GitHub workflow or ownership file. Contents not read.
3748	file	live code	not-opened	.github/workflows/moderator-lock.yml	GitHub workflow or ownership file. Contents not read.
2514	file	live code	not-opened	.github/workflows/pr-gates.yml	GitHub workflow or ownership file. Contents not read.
1165	file	live code	not-opened	.github/workflows/secret-scan.yml	GitHub workflow or ownership file. Contents not read.
3910	file	live code	not-opened	.github/workflows/self-improve.yml	GitHub workflow or ownership file. Contents not read.
9075	file	live code	not-opened	.github/workflows/worker.yml	GitHub workflow or ownership file. Contents not read.
1921	file	live code	opened	.gitignore	Ignore rules for dist, node_modules, env files, and several runtime paths.
1207	file	live code	not-opened	.gitleaks.toml	Repository file. Contents not read.
56	file	live code	not-opened	.npmrc	Repository file. Contents not read.
607	file	live code	not-opened	.replit	Repository file. Contents not read.
201	file	live code	not-opened	.replitignore	Repository file. Contents not read.
1366	file	docs	not-opened	CONSOLIDATION_TWO_REPOS.md	Markdown note. Contents not read.
850	file	docs	not-opened	IDENTITY.md	Markdown note. Contents not read.
1074	file	docs	not-opened	LICENSE	Repository file. Contents not read.
1066	file	docs	not-opened	NOTICE	Repository file. Contents not read.
11416	file	docs	opened	README.md	Repo overview: apps, ports, pnpm scripts, and the consolidation story.
5385	file	docs	not-opened	RESULTS.md	Markdown note. Contents not read.
4234	file	docs	not-opened	SETUP-FATHER.md	Markdown note. Contents not read.
9504	file	docs	not-opened	TODO.md	Markdown note. Contents not read.
366	file	archived	not-opened	archive/from-gitbook/.codebase-memory/artifact.json	Historical tree. Contents not read.
63	file	archived	not-opened	archive/from-gitbook/.gitbook.yaml	Historical tree. Contents not read.
562	file	archived	not-opened	archive/from-gitbook/README.md	Historical tree. Contents not read.
7041	file	archived	not-opened	archive/from-gitbook/SUMMARY.md	Historical tree. Contents not read.
5532	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/api-server/scripts/eval-chatbot.ts	Historical tree. Contents not read.
81616	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/api-server/src/lib/tessera-knowledge.ts	Historical tree. Contents not read.
15699	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/api-server/src/routes/legacy-engines.ts	Historical tree. Contents not read.
4170	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/api-server/src/routes/local-models.ts	Historical tree. Contents not read.
4154	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/api-server/src/routes/system-runtime.ts	Historical tree. Contents not read.
2511	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/mockup-sandbox/package.json	Historical tree. Contents not read.
1615	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/mockup-sandbox/vite.config.ts	Historical tree. Contents not read.
3107	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/tessera/package.json	Historical tree. Contents not read.
64768	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/tessera/src/components/ChatArea.tsx	Historical tree. Contents not read.
24356	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/tessera/src/components/HyperdimensionalBackground.tsx	Historical tree. Contents not read.
10731	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/tessera/src/components/MobileNav.tsx	Historical tree. Contents not read.
16486	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/tessera/src/components/chat/ChatCommands.ts	Historical tree. Contents not read.
17963	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/tessera/src/components/chat/ChatMessageItem.tsx	Historical tree. Contents not read.
7957	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/tessera/src/components/chat/ChatStreamingMessage.tsx	Historical tree. Contents not read.
23371	file	archived	not-opened	archive/from-gitbook/archive/moved/1/artifacts/tessera/src/hooks/use-chat.ts	Historical tree. Contents not read.
197	file	archived	not-opened	archive/from-gitbook/archive/moved/1/lib/api-spec/package.json	Historical tree. Contents not read.
585	file	archived	not-opened	archive/from-gitbook/archive/moved/1/package.json	Historical tree. Contents not read.
281	file	archived	not-opened	archive/from-gitbook/archive/moved/1/scripts/package.json	Historical tree. Contents not read.
371	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/.agents/memory/MEMORY.md	Historical tree. Contents not read.
1220692	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/5t/.agents/outputs/tx-local-blobs.json.gz.b64	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
610346	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/5t/.agents/outputs/tx-local-blobs.part1.b64	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
610346	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/5t/.agents/outputs/tx-local-blobs.part2.b64	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
61397	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/.agents/outputs/tx-snapshot-diffs-frontend.md	Historical tree. Contents not read.
33644	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/.agents/outputs/tx-snapshot-manifest.json	Historical tree. Contents not read.
624164	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/5t/.agents/outputs/tx-snapshot-variants.gz.b64	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
174530	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/.agents/outputs/tx-t44-unique/.agents__outputs__github-push-review.md	Historical tree. Contents not read.
3181	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/artifacts/api-server/data/applicant-declarations.jsonl	Historical tree. Contents not read.
54613	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/artifacts/api-server/data/declarations.jsonl	Historical tree. Contents not read.
4723	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/artifacts/api-server/data/improvement-conference-cli-verdict.json	Historical tree. Contents not read.
1386	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/artifacts/api-server/data/ingress-audit.jsonl	Historical tree. Contents not read.
290	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/artifacts/api-server/data/lattice-dms.jsonl	Historical tree. Contents not read.
1268	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/artifacts/api-server/data/lattice-posts.jsonl	Historical tree. Contents not read.
278	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/artifacts/api-server/data/lattice-replies.jsonl	Historical tree. Contents not read.
245	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/artifacts/api-server/data/lattice-votes.jsonl	Historical tree. Contents not read.
4756618	file	archived	not-opened	archive/from-gitbook/archive/moved/5t/artifacts/api-server/data/shepherd-audit.jsonl	Historical tree. Contents not read.
1041	file	archived	not-opened	archive/from-gitbook/archive/moved/COLLINK.md	Historical tree. Contents not read.
1144	file	archived	not-opened	archive/from-gitbook/archive/moved/Grok-ready/.gitignore	Historical tree. Contents not read.
5742	file	archived	not-opened	archive/from-gitbook/archive/moved/Grok-ready/README.md	Historical tree. Contents not read.
49014	file	archived	not-opened	archive/from-gitbook/archive/moved/Grok-ready/artifacts/api-server/src/lib/eval-runner.ts	Historical tree. Contents not read.
6894	file	archived	not-opened	archive/from-gitbook/archive/moved/Grok-ready/artifacts/api-server/src/lib/father-natal.ts	Historical tree. Contents not read.
7682	file	archived	not-opened	archive/from-gitbook/archive/moved/Grok-ready/artifacts/api-server/src/routes/index.ts	Historical tree. Contents not read.
18646	file	archived	not-opened	archive/from-gitbook/archive/moved/Grok-ready/docs/TESSERA_SYSTEM.md	Historical tree. Contents not read.
59342	file	archived	not-opened	archive/from-gitbook/archive/moved/Grok-ready/docs/grok-packet/06_SAFE_SOURCE_FILES/storefront-static/public/product-images/manifest.json	Historical tree. Contents not read.
9363	file	archived	not-opened	archive/from-gitbook/archive/moved/Grok-ready/docs/migration-review/local-archive-salvage.json	Historical tree. Contents not read.
427965	file	archived	not-opened	archive/from-gitbook/archive/moved/Grok-ready/docs/migration-review/repository-list-2.png	Historical tree. Contents not read.
2357	file	archived	not-opened	archive/from-gitbook/archive/moved/POINTERS.md	Historical tree. Contents not read.
225	file	archived	not-opened	archive/from-gitbook/archive/moved/README.md	Historical tree. Contents not read.
441	file	archived	not-opened	archive/from-gitbook/archive/moved/T44/.agents/memory/MEMORY.md	Historical tree. Contents not read.
727	file	archived	not-opened	archive/from-gitbook/archive/moved/TESS/artifacts/api-server/data/audit-manifest.json	Historical tree. Contents not read.
84	file	archived	not-opened	archive/from-gitbook/archive/moved/TESS/artifacts/api-server/data/ingress-audit.jsonl	Historical tree. Contents not read.
54385	file	archived	not-opened	archive/from-gitbook/archive/moved/TESS/artifacts/api-server/data/shepherd-audit.jsonl	Historical tree. Contents not read.
67	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.gitignore	Historical tree. Contents not read.
2312	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/preview.log	Historical tree. Contents not read.
2435	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/references/deploy-target.md	Historical tree. Contents not read.
12235	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/skills/building-games/SKILL.md	Historical tree. Contents not read.
12394	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/skills/imagine-grok-build/SKILL.md	Historical tree. Contents not read.
6618	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/skills/xai-api/SKILL.md	Historical tree. Contents not read.
90	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.grok/status	Historical tree. Contents not read.
90	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/.prettierrc	Historical tree. Contents not read.
477250	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2556.jpg	Historical tree. Contents not read.
497885	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2557.jpg	Historical tree. Contents not read.
571797	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2558.jpg	Historical tree. Contents not read.
601145	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2559.jpg	Historical tree. Contents not read.
598487	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2560.jpg	Historical tree. Contents not read.
616200	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2561.jpg	Historical tree. Contents not read.
353928	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2562.jpg	Historical tree. Contents not read.
387753	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2563.jpg	Historical tree. Contents not read.
432261	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2586.jpg	Historical tree. Contents not read.
414182	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2587.jpg	Historical tree. Contents not read.
437311	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2588.jpg	Historical tree. Contents not read.
408527	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2589.jpg	Historical tree. Contents not read.
435271	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2590.jpg	Historical tree. Contents not read.
394542	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2592.jpg	Historical tree. Contents not read.
127715	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2597.jpg	Historical tree. Contents not read.
424669	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2600.jpg	Historical tree. Contents not read.
478961	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2601.jpg	Historical tree. Contents not read.
414567	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2607.jpg	Historical tree. Contents not read.
433866	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2611.jpg	Historical tree. Contents not read.
356800	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2612.jpg	Historical tree. Contents not read.
630872	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2613.jpg	Historical tree. Contents not read.
468784	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2614.jpg	Historical tree. Contents not read.
404692	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2615.jpg	Historical tree. Contents not read.
506524	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2616.jpg	Historical tree. Contents not read.
232270	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2620.jpg	Historical tree. Contents not read.
192122	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2623.jpg	Historical tree. Contents not read.
360222	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2626.jpg	Historical tree. Contents not read.
508910	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2627.jpg	Historical tree. Contents not read.
457546	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2628.jpg	Historical tree. Contents not read.
495902	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2629.jpg	Historical tree. Contents not read.
354209	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2630.jpg	Historical tree. Contents not read.
552751	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2631.jpg	Historical tree. Contents not read.
314162	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2632.jpg	Historical tree. Contents not read.
495181	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2633.jpg	Historical tree. Contents not read.
429627	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2634.jpg	Historical tree. Contents not read.
417768	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2635.jpg	Historical tree. Contents not read.
775045	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2636.jpg	Historical tree. Contents not read.
325783	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2637.jpg	Historical tree. Contents not read.
438524	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2638.jpg	Historical tree. Contents not read.
455369	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2644.jpg	Historical tree. Contents not read.
477227	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/IMG_2645.jpg	Historical tree. Contents not read.
63217	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/Microsoft Copilot.pdf	Historical tree. Contents not read.
48669	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/Microsoft Copilot2.pdf	Historical tree. Contents not read.
48579	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/Microsoft Copilot3.pdf	Historical tree. Contents not read.
4036	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/attachments/Pasted Text.txt	Historical tree. Contents not read.
804	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/coordination/BOARD_ASK.txt	Historical tree. Contents not read.
659	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/coordination/ZZ_NOW.txt	Historical tree. Contents not read.
3887371	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/ingest/manifest.json	Historical tree. Contents not read.
1158	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/FATHER.md	Historical tree. Contents not read.
2353	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/HANDOFF.md	Historical tree. Contents not read.
37	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/agent-check.txt	Historical tree. Contents not read.
42	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/agent-plan.txt	Historical tree. Contents not read.
186945	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/auto-log.jsonl	Historical tree. Contents not read.
5697	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/brief.txt	Historical tree. Contents not read.
659	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/connections.txt	Historical tree. Contents not read.
19617	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/desk-study.jsonl	Historical tree. Contents not read.
773	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/gaps.txt	Historical tree. Contents not read.
98351	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/local.txt	Historical tree. Contents not read.
52940	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/retained.txt	Historical tree. Contents not read.
8177	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/seen-local.txt	Historical tree. Contents not read.
1076	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/train.jsonl	Historical tree. Contents not read.
113091	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/school/z-paths.txt	Historical tree. Contents not read.
3924	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/workshop/CATALOG.md	Historical tree. Contents not read.
416	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/workshop/GRAPH.md	Historical tree. Contents not read.
53	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/workshop/INDEX.md	Historical tree. Contents not read.
971	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/workshop/NOTES.md	Historical tree. Contents not read.
1669	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/workshop/REPOS.md	Historical tree. Contents not read.
1244	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/data/workshop/history.jsonl	Historical tree. Contents not read.
190444	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/app-builder-built-mobile.png	Historical tree. Contents not read.
1232	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/app-builder-built.json	Historical tree. Contents not read.
410177	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/app-builder-built.png	Historical tree. Contents not read.
198643	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/app-builder-preview-mobile.png	Historical tree. Contents not read.
1182	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/app-builder-preview.json	Historical tree. Contents not read.
240491	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/app-builder-preview.png	Historical tree. Contents not read.
257629	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/chamber.png	Historical tree. Contents not read.
173713	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/chat.png	Historical tree. Contents not read.
143131	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/fix-now.png	Historical tree. Contents not read.
283336	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/lattice.png	Historical tree. Contents not read.
321598	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/learn.png	Historical tree. Contents not read.
348726	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/pulse.png	Historical tree. Contents not read.
209257	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/self.png	Historical tree. Contents not read.
304637	file	archived	not-opened	archive/from-gitbook/archive/moved/olive-giant-ever-glade/screenshots/world.png	Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-000	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-001	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-002	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-003	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-004	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-005	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-006	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-007	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-008	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-009	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-010	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-011	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-012	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-013	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-014	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-015	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-016	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-017	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-018	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-019	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-020	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-021	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-022	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-023	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-024	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-025	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-026	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-027	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-028	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-029	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-030	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-031	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-032	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-033	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-034	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-035	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-036	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-037	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-038	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-039	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-040	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-041	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-042	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-043	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-044	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-045	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-046	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-047	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-048	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-049	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-050	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-051	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-052	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-053	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-054	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-055	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-056	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-057	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-058	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-059	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-060	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-061	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-062	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-063	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-064	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-065	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-066	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-067	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-068	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-069	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-070	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-071	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-072	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-073	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-074	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-075	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-076	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-077	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-078	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-079	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-080	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-081	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-082	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-083	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-084	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-085	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-086	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-087	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-088	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-089	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-090	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-091	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-092	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-093	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-094	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-095	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-096	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-097	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-098	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-099	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-100	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-101	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-102	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-103	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-104	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-105	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-106	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-107	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-108	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-109	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-110	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-111	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-112	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-113	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-114	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-115	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-116	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
147264	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff-images.zip.part-117	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-000	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-001	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-002	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-003	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-004	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-005	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-006	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-007	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-008	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-009	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-010	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-011	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-012	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-013	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-014	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-015	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-016	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-017	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-018	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-019	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-020	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-021	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-022	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-023	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-024	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-025	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-026	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-027	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-028	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-029	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-030	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-031	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-032	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-033	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-034	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-035	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-036	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-037	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-038	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-039	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-040	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-041	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-042	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-043	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-044	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-045	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-046	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-047	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-048	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-049	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-050	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-051	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-052	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-053	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-054	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-055	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-056	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-057	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-058	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-059	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-060	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-061	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-062	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-063	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-064	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-065	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-066	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-067	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-068	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-069	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-070	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-071	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-072	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-073	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-074	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-075	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-076	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-077	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-078	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-079	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-080	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-081	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-082	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-083	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-084	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-085	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-086	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-087	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-088	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-089	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-090	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
270393	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-handoff.zip.part-091	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-000	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-001	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-002	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-003	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-004	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-005	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-006	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-007	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-008	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-009	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-010	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-011	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-012	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-013	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-014	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-015	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-016	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-017	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-018	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-019	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-020	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-021	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-022	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-023	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-024	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-025	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-026	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-027	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-028	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-029	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-030	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-031	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-032	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-033	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-034	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-035	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-036	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-037	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-038	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-039	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-040	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-041	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-042	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-043	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-044	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-045	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-046	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-047	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-048	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-049	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-050	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-051	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-052	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-053	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-054	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-055	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-056	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-057	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-058	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-059	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-060	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-061	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-062	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-063	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-064	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-065	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-066	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-067	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-068	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-069	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-070	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-071	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-072	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-073	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-074	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-075	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-076	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-077	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-078	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-079	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-080	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-081	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-082	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-083	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-084	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-085	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-086	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-087	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-088	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-089	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-090	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-091	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-092	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-093	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-094	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-095	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-096	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-097	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-098	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-099	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-100	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
6157	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-complete-archives/parts/grok-workspace_1789591148371.zip.part-101	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-000	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-001	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-002	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-003	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-004	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-005	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-006	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-007	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-008	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-009	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-010	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-011	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-012	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-013	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-014	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-015	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-016	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-017	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-018	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-019	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-020	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-021	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-022	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-023	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-024	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-025	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-026	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-027	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-028	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-029	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-030	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-031	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-032	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-033	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-034	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-035	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-036	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-037	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-038	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-039	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-040	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-041	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-042	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-043	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-044	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-045	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-046	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-047	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-048	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-049	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-050	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-051	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-052	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-053	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-054	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-055	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-056	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-057	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-058	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-059	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-060	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-061	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-062	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-063	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-064	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-065	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-066	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-067	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-068	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-069	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-070	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-071	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-072	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-073	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-074	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-075	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-076	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-077	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-078	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-079	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-080	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-081	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-082	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-083	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-084	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-085	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-086	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-087	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-088	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-089	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-090	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-091	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-092	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-093	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-094	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-095	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-096	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-097	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-098	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-099	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-100	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-101	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-102	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-103	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-104	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-105	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-106	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-107	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-108	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-109	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-110	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-111	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-112	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-113	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-114	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-115	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-116	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
147337	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff-images.zip.part-117	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-000	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-001	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-002	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-003	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-004	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-005	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-006	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-007	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-008	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-009	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-010	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-011	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-012	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-013	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-014	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-015	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-016	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-017	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-018	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-019	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-020	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-021	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-022	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-023	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-024	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-025	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-026	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-027	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-028	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-029	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-030	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-031	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-032	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-033	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-034	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-035	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-036	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-037	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-038	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-039	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-040	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-041	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-042	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-043	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-044	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-045	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-046	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-047	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-048	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-049	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-050	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-051	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-052	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-053	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-054	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-055	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-056	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-057	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-058	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-059	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-060	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-061	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-062	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-063	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-064	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-065	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-066	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-067	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-068	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-069	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-070	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-071	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-072	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-073	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-074	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-075	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-076	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-077	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-078	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-079	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-080	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-081	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-082	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-083	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-084	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-085	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-086	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-087	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-088	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-089	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-090	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
272729	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-handoff.zip.part-091	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-000	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-001	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-002	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-003	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-004	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-005	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-006	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-007	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-008	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-009	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-010	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-011	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-012	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-013	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-014	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-015	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-016	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-017	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-018	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-019	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-020	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-021	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-022	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-023	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-024	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-025	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-026	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-027	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-028	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-029	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-030	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-031	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-032	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-033	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-034	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-035	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-036	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-037	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-038	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-039	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-040	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-041	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-042	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-043	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-044	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-045	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-046	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-047	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-048	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-049	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-050	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-051	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-052	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-053	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-054	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-055	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-056	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-057	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-058	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-059	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-060	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-061	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-062	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-063	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-064	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-065	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-066	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-067	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-068	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-069	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-070	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-071	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-072	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-073	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-074	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-075	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-076	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-077	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-078	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-079	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-080	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-081	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-082	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-083	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-084	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-085	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-086	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-087	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-088	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-089	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-090	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-091	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-092	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-093	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-094	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-095	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-096	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-097	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-098	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-099	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
524288	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-100	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
6122	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/parts/grok-workspace_1789591148371.zip.part-101	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
110542	file	archived	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/source-screenshot-supplement/03-evidence/IMG_2552_1790876400297.jpeg	Historical tree. Contents not read.
930778	file	archived	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/source-screenshot-supplement/03-evidence/IMG_2553_1790876458294.png	Historical tree. Contents not read.
1022163	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff-complete/source-screenshot-supplement/Tessera-Grok-Screenshot-Supplement.zip	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-000	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-001	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-002	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-003	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-004	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-005	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-006	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-007	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-008	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-009	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-010	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-011	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-012	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-013	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-014	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-015	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-016	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-017	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-018	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-019	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-020	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-021	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-022	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-023	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
2097152	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-024	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
571516	file	unopened archive	not-opened	archive/from-gitbook/archive/moved/tessera-grok-handoff/grok-workspace_1789591148371.zip.part-025	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
4846	file	archived	not-opened	archive/from-gitbook/brain-consciousness/AGENT-WORKPLAN.md	Historical tree. Contents not read.
4649	file	archived	not-opened	archive/from-gitbook/brain-consciousness/AGI-06-second-run-protocol.md	Historical tree. Contents not read.
7821	file	archived	not-opened	archive/from-gitbook/brain-consciousness/AGI-COLLABORATION-IMPROVEMENT-ROADMAP.md	Historical tree. Contents not read.
4761	file	archived	not-opened	archive/from-gitbook/brain-consciousness/EXECUTION-BOARD-20.md	Historical tree. Contents not read.
3475	file	archived	not-opened	archive/from-gitbook/brain-consciousness/GLM5-AUDIT-FOLLOWUPS.md	Historical tree. Contents not read.
1293	file	archived	not-opened	archive/from-gitbook/brain-consciousness/GLM5-PEN-APPROVAL-2026-10-06.md	Historical tree. Contents not read.
3003	file	archived	not-opened	archive/from-gitbook/brain-consciousness/GLM5-PEN-INTEGRATION.md	Historical tree. Contents not read.
3607	file	archived	not-opened	archive/from-gitbook/brain-consciousness/SNN-SOURCE-MANIFEST.md	Historical tree. Contents not read.
2431	file	archived	not-opened	archive/from-gitbook/brain-consciousness/TESSERA-PEN-RESEARCH-CHARTER.md	Historical tree. Contents not read.
5733	file	archived	not-opened	archive/from-gitbook/brain-consciousness/capability-registry.md	Historical tree. Contents not read.
1403	file	archived	not-opened	archive/from-gitbook/brain-consciousness/provenance-memory/README.md	Historical tree. Contents not read.
1480	file	archived	not-opened	archive/from-gitbook/brain-consciousness/provenance-memory/records.jsonl	Historical tree. Contents not read.
2362	file	archived	not-opened	archive/from-gitbook/brain-consciousness/provenance-memory/validate_records.py	Historical tree. Contents not read.
12730	file	archived	not-opened	archive/from-gitbook/brain-consciousness/reports/AGI-01-analysis.md	Historical tree. Contents not read.
13641	file	archived	not-opened	archive/from-gitbook/brain-consciousness/reports/AGI-02-analysis.md	Historical tree. Contents not read.
13178	file	archived	not-opened	archive/from-gitbook/brain-consciousness/reports/AGI-03-analysis.md	Historical tree. Contents not read.
10101	file	archived	not-opened	archive/from-gitbook/brain-consciousness/reports/AGI-06-reproduction-001.md	Historical tree. Contents not read.
539	file	archived	not-opened	archive/from-gitbook/brain-consciousness/reports/README.md	Historical tree. Contents not read.
3985	file	archived	not-opened	archive/from-gitbook/brain/ONE-TOPIC.md	Historical tree. Contents not read.
827	file	archived	not-opened	archive/from-gitbook/brain/README.md	Historical tree. Contents not read.
3132	file	archived	not-opened	archive/from-gitbook/forum/IDEA-FORUM.md	Historical tree. Contents not read.
5324	file	archived	not-opened	archive/from-gitbook/history/coordination/AGENT-CONFERENCE.md	Historical tree. Contents not read.
5566	file	archived	not-opened	archive/from-gitbook/history/coordination/AGENT-TRAINING-AUTHENTICITY.md	Historical tree. Contents not read.
4222	file	archived	not-opened	archive/from-gitbook/history/coordination/agent-checkins.md	Historical tree. Contents not read.
262	file	archived	not-opened	archive/from-gitbook/history/coordination/command-center.md	Historical tree. Contents not read.
1058	file	archived	not-opened	archive/from-gitbook/history/coordination/coordination-record.md	Historical tree. Contents not read.
172	file	archived	not-opened	archive/from-gitbook/history/coordination/coordination-repository-readme.md	Historical tree. Contents not read.
1046	file	archived	not-opened	archive/from-gitbook/history/coordination/tessera-pen-record.md	Historical tree. Contents not read.
923	file	archived	not-opened	archive/from-gitbook/history/recovered/README.md	Historical tree. Contents not read.
5769	file	archived	not-opened	archive/from-gitbook/history/recovered/chronology/Grok-ready/README.md	Historical tree. Contents not read.
294	file	archived	not-opened	archive/from-gitbook/history/recovered/chronology/Grok-ready/grok-packet/README.md	Historical tree. Contents not read.
4436	file	archived	not-opened	archive/from-gitbook/history/recovered/chronology/Grok-ready/migration-review/README.md	Historical tree. Contents not read.
819	file	archived	not-opened	archive/from-gitbook/history/recovered/coordination/STATUS.md	Historical tree. Contents not read.
247	file	archived	not-opened	archive/from-gitbook/history/recovered/coordination/cards/replit-1.md	Historical tree. Contents not read.
290	file	archived	not-opened	archive/from-gitbook/history/recovered/coordination/cards/replit-2.md	Historical tree. Contents not read.
237	file	archived	not-opened	archive/from-gitbook/history/recovered/coordination/cards/replit-3.md	Historical tree. Contents not read.
321	file	archived	not-opened	archive/from-gitbook/history/recovered/coordination/cards/replit-4.md	Historical tree. Contents not read.
317	file	archived	not-opened	archive/from-gitbook/history/recovered/coordination/cards/replit-5.md	Historical tree. Contents not read.
3878	file	archived	not-opened	archive/from-gitbook/history/recovered/coordination/checks/ability.test.mjs	Historical tree. Contents not read.
318	file	archived	not-opened	archive/from-gitbook/history/recovered/coordination/notes/2026-10-03-chamber-desk.md	Historical tree. Contents not read.
1604	file	archived	not-opened	archive/from-gitbook/history/recovered/coordination/notes/2026-10-03-chamber-sync.md	Historical tree. Contents not read.
7368	file	archived	not-opened	archive/from-gitbook/history/recovered/legacy/everything-migration-instructions.md	Historical tree. Contents not read.
78	file	archived	not-opened	archive/from-gitbook/history/recovered/legacy/tessera-gitbook-readme.md	Historical tree. Contents not read.
435	file	archived	not-opened	archive/from-gitbook/history/recovered/legacy/tessera-replit-readme.md	Historical tree. Contents not read.
11693	file	archived	not-opened	archive/from-gitbook/history/recovered/mirror-notes/1-language-security-conference.json	Historical tree. Contents not read.
789	file	archived	not-opened	archive/from-gitbook/history/recovered/mirror-notes/5t-AGENTS.md	Historical tree. Contents not read.
5074	file	archived	not-opened	archive/from-gitbook/history/recovered/mirror-notes/5t-tessera-consolidation-gate.md	Historical tree. Contents not read.
814	file	archived	not-opened	archive/from-gitbook/history/recovered/mirror-notes/5t-tx-snapshot-diffs-other.md	Historical tree. Contents not read.
471	file	archived	not-opened	archive/from-gitbook/history/recovered/mirror-notes/README.md	Historical tree. Contents not read.
2363	file	archived	not-opened	archive/from-gitbook/history/recovered/mirror-notes/T44-agent-coordination.md	Historical tree. Contents not read.
2244	file	archived	not-opened	archive/from-gitbook/history/recovered/mirror-notes/T44-repository-migration-policy.md	Historical tree. Contents not read.
4969	file	archived	not-opened	archive/from-gitbook/history/recovered/mirror-notes/TESS-improvement-conference-verdict.json	Historical tree. Contents not read.
336	file	archived	not-opened	archive/from-gitbook/history/recovered/source-index/tessera-agent-handoff.md	Historical tree. Contents not read.
2798	file	archived	not-opened	archive/from-gitbook/history/recovered/source-index/z-readme.md	Historical tree. Contents not read.
5474	file	archived	not-opened	archive/from-gitbook/history/recovered/source-versions/tessera-unified/README.md	Historical tree. Contents not read.
7061	file	archived	not-opened	archive/from-gitbook/history/recovered/source-versions/tessera-unified/docs/CONSOLIDATION.md	Historical tree. Contents not read.
1466	file	archived	not-opened	archive/from-gitbook/history/recovered/source-versions/tessera-unified/docs/PROJECT_MAP.md	Historical tree. Contents not read.
2764	file	archived	not-opened	archive/from-gitbook/history/recovered/source-versions/tessera-unified/docs/SECRETS.md	Historical tree. Contents not read.
714	file	archived	not-opened	archive/from-gitbook/history/recovered/source-versions/tessera-unified/package.json	Historical tree. Contents not read.
4834	file	archived	not-opened	archive/from-gitbook/history/recovered/source-versions/tessera-unified/scripts/dev-unified.mjs	Historical tree. Contents not read.
3429	file	archived	not-opened	archive/from-gitbook/history/recovered/source-versions/tessera-unified/scripts/test-unified.mjs	Historical tree. Contents not read.
424	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/README.md	Historical tree. Contents not read.
809	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--.agents__memory__github-publishing.md	Historical tree. Contents not read.
880	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--.agents__memory__tessera-identity-and-origin.md	Historical tree. Contents not read.
693	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--.agents__memory__tessera-repository-approvals.md	Historical tree. Contents not read.
2557	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--AGENTS.md	Historical tree. Contents not read.
3644	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--TESSERA_AGENT_HANDOFF.md	Historical tree. Contents not read.
10865	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--agent-notes__2026-10-06-rebuild-consolidation-draft.md	Historical tree. Contents not read.
2293	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--agent-notes__2026-10-06-replit-agent-safe-modules.md	Historical tree. Contents not read.
8323	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--artifacts__z-app__MERGE_REPORT.md	Historical tree. Contents not read.
4874	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--replit.md	Historical tree. Contents not read.
760	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--tessera-control__README.md	Historical tree. Contents not read.
3117	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/Zz--tessera-control__source-z__README.md	Historical tree. Contents not read.
18920	file	archived	not-opened	archive/from-gitbook/history/recovered/zz-olive/olive-giant-ever-glade--AGENTS.md	Historical tree. Contents not read.
4005	file	archived	not-opened	archive/from-gitbook/history/source-index/z-catalog.md	Historical tree. Contents not read.
2878	file	archived	not-opened	archive/from-gitbook/history/source-index/z-repository-index.md	Historical tree. Contents not read.
2461	file	archived	not-opened	archive/from-gitbook/history/source-index/z-walk.md	Historical tree. Contents not read.
5941	file	archived	not-opened	archive/from-gitbook/intake/AGENT-COLLABORATION-HUB.md	Historical tree. Contents not read.
8619	file	archived	not-opened	archive/from-gitbook/intake/AGENT-LAUNCH-PROMPTS.md	Historical tree. Contents not read.
2243	file	archived	not-opened	archive/from-gitbook/intake/CONFERENCE-NEXT-STEPS.md	Historical tree. Contents not read.
7126	file	archived	not-opened	archive/from-gitbook/intake/CORTICAL-LABS-READINESS.md	Historical tree. Contents not read.
3301	file	archived	not-opened	archive/from-gitbook/intake/FUTURE-AGENT-MARKETPLACE-ROADMAP.md	Historical tree. Contents not read.
10611	file	archived	not-opened	archive/from-gitbook/intake/HYBRID-CONSOLIDATION-BACKLOG.md	Historical tree. Contents not read.
2022	file	archived	not-opened	archive/from-gitbook/intake/agent-submission-format.md	Historical tree. Contents not read.
1532	file	archived	not-opened	archive/from-gitbook/intake/bhnmc-feasibility-share.md	Historical tree. Contents not read.
2561	file	archived	not-opened	archive/from-gitbook/intake/consolidated-todo.md	Historical tree. Contents not read.
2855	file	archived	not-opened	archive/from-gitbook/intake/how-to-submit.md	Historical tree. Contents not read.
23771	file	archived	not-opened	archive/from-gitbook/intake/log.md	Historical tree. Contents not read.
3913	file	archived	not-opened	archive/from-gitbook/intake/status-definitions.md	Historical tree. Contents not read.
5321	file	archived	not-opened	archive/from-gitbook/merge/ALL-REPOSITORIES-ROUTING-2026-10-07.md	Historical tree. Contents not read.
3452	file	archived	not-opened	archive/from-gitbook/merge/CANONICAL-DESTINATIONS-NO-REPLICAS-2026-10-07.md	Historical tree. Contents not read.
3579	file	archived	not-opened	archive/from-gitbook/merge/CHRONOLOGICAL-SOURCE-REVIEW.md	Historical tree. Contents not read.
3024	file	archived	not-opened	archive/from-gitbook/merge/CURRENT-REPOSITORY-STATUS.md	Historical tree. Contents not read.
4237	file	archived	not-opened	archive/from-gitbook/merge/DELETION-MANIFEST.md	Historical tree. Contents not read.
5833	file	archived	not-opened	archive/from-gitbook/merge/FULL-AUDIT-SUMMARY.md	Historical tree. Contents not read.
3458	file	archived	not-opened	archive/from-gitbook/merge/FUNCTIONAL-MERGE-MATRIX.md	Historical tree. Contents not read.
2059	file	archived	not-opened	archive/from-gitbook/merge/HYB-011-EXCLUSION-MANIFEST.md	Historical tree. Contents not read.
2853	file	archived	not-opened	archive/from-gitbook/merge/SOURCE-HEADS-2026-10-05.md	Historical tree. Contents not read.
8014	file	archived	not-opened	archive/from-gitbook/merge/current-coverage-2026-10-07.json	Historical tree. Contents not read.
674	file	archived	not-opened	archive/from-gitbook/merge/current-coverage-2026-10-07.tsv	Historical tree. Contents not read.
1859	file	archived	not-opened	archive/from-gitbook/merge/duplicate-disposition.md	Historical tree. Contents not read.
1825715	file	archived	not-opened	archive/from-gitbook/merge/duplicate-groups.tsv	Historical tree. Contents not read.
1659281	file	archived	not-opened	archive/from-gitbook/merge/exact-duplicates.tsv	Historical tree. Contents not read.
1671276	file	archived	not-opened	archive/from-gitbook/merge/full-audit-report.json	Historical tree. Contents not read.
870	file	archived	not-opened	archive/from-gitbook/merge/full-audit-summary.tsv	Historical tree. Contents not read.
2284	file	archived	not-opened	archive/from-gitbook/merge/hyb-005-braces-decision.md	Historical tree. Contents not read.
4875	file	archived	not-opened	archive/from-gitbook/merge/hyb-006-grok-ready.md	Historical tree. Contents not read.
11971	file	archived	not-opened	archive/from-gitbook/merge/hyb-007-z-app.md	Historical tree. Contents not read.
4937	file	archived	not-opened	archive/from-gitbook/merge/repo-audit.tsv	Historical tree. Contents not read.
3328	file	archived	not-opened	archive/from-gitbook/merge/source-map.md	Historical tree. Contents not read.
3034	file	archived	not-opened	archive/from-gitbook/mesh/AGENT-SKILL-MATRIX.md	Historical tree. Contents not read.
4764	file	archived	not-opened	archive/from-gitbook/mesh/CODEBASE-MEMORY-MCP.md	Historical tree. Contents not read.
2734	file	archived	not-opened	archive/from-gitbook/mesh/COLLABORATION-METRICS.md	Historical tree. Contents not read.
5283	file	archived	not-opened	archive/from-gitbook/mesh/COLLABORATION-PLAYBOOK.md	Historical tree. Contents not read.
6427	file	archived	not-opened	archive/from-gitbook/mesh/GITHUB-REPOS.txt	Historical tree. Contents not read.
7775	file	archived	not-opened	archive/from-gitbook/mesh/GRAFT-AGENT-PUBLISHING.md	Historical tree. Contents not read.
5858	file	archived	not-opened	archive/from-gitbook/mesh/HANDOFF.md	Historical tree. Contents not read.
626	file	archived	not-opened	archive/from-gitbook/mesh/OFFLINE-INTERNET.md	Historical tree. Contents not read.
7730	file	archived	not-opened	archive/from-gitbook/mesh/TESSERA-GITBOOK-OPERATING-MODE.md	Historical tree. Contents not read.
1845	file	archived	not-opened	archive/from-gitbook/mesh/TESSERA-HYBRID-SKILLS.md	Historical tree. Contents not read.
1346	file	archived	not-opened	archive/from-gitbook/mesh/TODOS.md	Historical tree. Contents not read.
15260	file	archived	not-opened	archive/from-gitbook/mesh/flow.md	Historical tree. Contents not read.
4308	file	archived	not-opened	archive/from-gitbook/mesh/mentioned-repos.txt	Historical tree. Contents not read.
3135	file	archived	not-opened	archive/from-gitbook/mesh/replit-agents-start-here.md	Historical tree. Contents not read.
6338	file	archived	not-opened	archive/from-gitbook/mesh/roles.md	Historical tree. Contents not read.
3192	file	archived	not-opened	archive/from-gitbook/mesh/roles/board-world-chamber.md	Historical tree. Contents not read.
2614	file	archived	not-opened	archive/from-gitbook/mesh/roles/build.md	Historical tree. Contents not read.
4945	file	archived	not-opened	archive/from-gitbook/mesh/roles/command-center.md	Historical tree. Contents not read.
1464	file	archived	not-opened	archive/from-gitbook/mesh/roles/gitbook-cordnation.md	Historical tree. Contents not read.
1035	file	archived	not-opened	archive/from-gitbook/mesh/roles/gitbook-moderator.md	Historical tree. Contents not read.
347	file	archived	not-opened	archive/from-gitbook/mesh/roles/github-scraper.md	Historical tree. Contents not read.
1182	file	archived	not-opened	archive/from-gitbook/mesh/roles/grok-bot.md	Historical tree. Contents not read.
1596	file	archived	not-opened	archive/from-gitbook/mesh/roles/honesty-banner.md	Historical tree. Contents not read.
335	file	archived	not-opened	archive/from-gitbook/mesh/roles/mesh-cloud.md	Historical tree. Contents not read.
7125	file	archived	not-opened	archive/from-gitbook/mesh/roles/mesh-lane-map.md	Historical tree. Contents not read.
1992	file	archived	not-opened	archive/from-gitbook/mesh/roles/open-helper-agent-2.md	Historical tree. Contents not read.
293	file	archived	not-opened	archive/from-gitbook/mesh/roles/open-helper-agent.md	Historical tree. Contents not read.
2696	file	archived	not-opened	archive/from-gitbook/mesh/roles/pen-ability-set-framing.md	Historical tree. Contents not read.
2365	file	archived	not-opened	archive/from-gitbook/mesh/roles/pen-gate-refuse-companion.md	Historical tree. Contents not read.
4469	file	archived	not-opened	archive/from-gitbook/mesh/roles/pen-tone-guide.md	Historical tree. Contents not read.
341	file	archived	not-opened	archive/from-gitbook/mesh/roles/recursive-learning-sponge.md	Historical tree. Contents not read.
2266	file	archived	not-opened	archive/from-gitbook/mesh/roles/refuse-and-offer.md	Historical tree. Contents not read.
1469	file	archived	not-opened	archive/from-gitbook/mesh/roles/security.md	Historical tree. Contents not read.
2899	file	archived	not-opened	archive/from-gitbook/mesh/roles/tessera-brain-consciousness.md	Historical tree. Contents not read.
3646	file	archived	not-opened	archive/from-gitbook/mesh/roles/tessera-pen.md	Historical tree. Contents not read.
1073	file	archived	not-opened	archive/from-gitbook/mesh/roles/tessera.md	Historical tree. Contents not read.
2917	file	archived	not-opened	archive/from-gitbook/mesh/roles/who-tessera-is.md	Historical tree. Contents not read.
2073	file	archived	not-opened	archive/from-gitbook/operations/building-tessera.md	Historical tree. Contents not read.
4125	file	archived	not-opened	archive/from-gitbook/operations/code-lookup-graph.md	Historical tree. Contents not read.
4649	file	archived	not-opened	archive/from-gitbook/operations/functional-combine-hybrid-b.md	Historical tree. Contents not read.
5314	file	archived	not-opened	archive/from-gitbook/operations/mesh-speed-collaboration.md	Historical tree. Contents not read.
1751	file	archived	not-opened	archive/from-gitbook/operations/openai-removed.md	Historical tree. Contents not read.
2721	file	archived	not-opened	archive/from-gitbook/operations/option-competition.md	Historical tree. Contents not read.
1825	file	archived	not-opened	archive/from-gitbook/operations/tessera-operating-guidelines.md	Historical tree. Contents not read.
1061	file	archived	not-opened	archive/from-gitbook/posts/2026-10-07-consolidation-audit.md	Historical tree. Contents not read.
4982	file	archived	not-opened	archive/from-gitbook/posts/2026-10-07-external-rea-adoption.md	Historical tree. Contents not read.
1770	file	archived	not-opened	archive/from-gitbook/posts/2026-10-07-full-coverage-and-v2-merge.md	Historical tree. Contents not read.
4083	file	archived	not-opened	archive/from-gitbook/posts/2026-10-07-rea-deep-scan.md	Historical tree. Contents not read.
3694	file	archived	not-opened	archive/from-gitbook/posts/2026-10-07-rea-registry.md	Historical tree. Contents not read.
2494	file	archived	not-opened	archive/from-gitbook/posts/2026-10-07-tessera-v2-stage1.md	Historical tree. Contents not read.
2448	file	archived	not-opened	archive/from-gitbook/posts/2026-10-07-tessera-v2-stage2.md	Historical tree. Contents not read.
1145	file	archived	not-opened	archive/from-gitbook/posts/2026-10-08-memory-graph-scan.md	Historical tree. Contents not read.
2122	file	archived	not-opened	archive/from-gitbook/review/COLLABORATION-AUDIT-2026-10-05.md	Historical tree. Contents not read.
4563	file	archived	not-opened	archive/from-gitbook/review/handoff-packet-batch-013.md	Historical tree. Contents not read.
4620	file	archived	not-opened	archive/from-gitbook/review/moderator-handoff.md	Historical tree. Contents not read.
4809	file	archived	not-opened	archive/from-gitbook/review/source-branch-review.md	Historical tree. Contents not read.
5383	file	archived	not-opened	archive/from-gitbook/review/validation.md	Historical tree. Contents not read.
1321	file	archived	not-opened	archive/from-gitbook/state/README.md	Historical tree. Contents not read.
2497	file	archived	not-opened	archive/from-gitbook/state/validate_world_model.py	Historical tree. Contents not read.
3035	file	archived	not-opened	archive/from-gitbook/state/world-model.json	Historical tree. Contents not read.
2114	file	archived	not-opened	archive/from-gitbook/state/world-model.schema.json	Historical tree. Contents not read.
543	file	archived	opened	archive/sections/3_9_1776105526328/README.md	Says five parts reassemble one zip. The zip was not reassembled or opened.
47185920	file	unopened archive	not-opened	archive/sections/3_9_1776105526328/part-01	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
47185920	file	unopened archive	not-opened	archive/sections/3_9_1776105526328/part-02	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
47185920	file	unopened archive	not-opened	archive/sections/3_9_1776105526328/part-03	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
47185920	file	unopened archive	not-opened	archive/sections/3_9_1776105526328/part-04	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
1122043	file	unopened archive	not-opened	archive/sections/3_9_1776105526328/part-05	Unopened. Bytes were hashed for duplicate detection and were not extracted. Historical tree. Contents not read.
579	file	archived	not-opened	archives/README.md	Historical tree. Contents not read.
20320	file	archived	not-opened	archives/migration-review/archive-helpers/grok-pwa-plugin.test.mjs	Historical tree. Contents not read.
1193	file	archived	not-opened	archives/migration-review/archive-helpers/reassemble_archives-4772961aef.py	Historical tree. Contents not read.
879	file	archived	not-opened	archives/migration-review/archive-helpers/reassemble_archives.py	Historical tree. Contents not read.
1206	file	archived	not-opened	archives/migration-review/archive-helpers/reassemble_handoff-75265ab384.py	Historical tree. Contents not read.
156	file	archived	not-opened	archives/migration-review/archive-helpers/reassemble_handoff.py	Historical tree. Contents not read.
7511	file	archived	not-opened	archives/migration-review/archive-helpers/simulation.test.mjs	Historical tree. Contents not read.
19261	file	archived	not-opened	archives/migration-review/legacy-ui/AGIComparisonPage.tsx	Historical tree. Contents not read.
22869	file	archived	not-opened	archives/migration-review/legacy-ui/AGIImplementationsPage.tsx	Historical tree. Contents not read.
22843	file	archived	not-opened	archives/migration-review/legacy-ui/AGISummitPage.tsx	Historical tree. Contents not read.
8605	file	archived	not-opened	archives/migration-review/legacy-ui/ActivityFeedPage.tsx	Historical tree. Contents not read.
14003	file	archived	not-opened	archives/migration-review/legacy-ui/AgentCodeBuildingPage.tsx	Historical tree. Contents not read.
24216	file	archived	not-opened	archives/migration-review/legacy-ui/AgentCommsPage.tsx	Historical tree. Contents not read.
18480	file	archived	not-opened	archives/migration-review/legacy-ui/AgentEconomyPage.tsx	Historical tree. Contents not read.
5446	file	archived	not-opened	archives/migration-review/legacy-ui/AgentSecretsPage.tsx	Historical tree. Contents not read.
13442	file	archived	not-opened	archives/migration-review/legacy-ui/AgentVoicePage.tsx	Historical tree. Contents not read.
26582	file	archived	not-opened	archives/migration-review/legacy-ui/AlertsDashboardPage.tsx	Historical tree. Contents not read.
13491	file	archived	not-opened	archives/migration-review/legacy-ui/AutonomyDashboardPage.tsx	Historical tree. Contents not read.
13907	file	archived	not-opened	archives/migration-review/legacy-ui/AutonomyNerveCenterPage.tsx	Historical tree. Contents not read.
58004	file	archived	not-opened	archives/migration-review/legacy-ui/BenchmarkAuditPage.tsx	Historical tree. Contents not read.
39274	file	archived	not-opened	archives/migration-review/legacy-ui/BiosphericConsciousnessPage.tsx	Historical tree. Contents not read.
33009	file	archived	not-opened	archives/migration-review/legacy-ui/CheatCodesPage.tsx	Historical tree. Contents not read.
43369	file	archived	not-opened	archives/migration-review/legacy-ui/ColonelLanguagePage.tsx	Historical tree. Contents not read.
24036	file	archived	not-opened	archives/migration-review/legacy-ui/CommandPage.tsx	Historical tree. Contents not read.
26082	file	archived	not-opened	archives/migration-review/legacy-ui/CommunityHubPage.tsx	Historical tree. Contents not read.
25625	file	archived	not-opened	archives/migration-review/legacy-ui/ConferenceDecisionsPage.tsx	Historical tree. Contents not read.
3530	file	archived	not-opened	archives/migration-review/legacy-ui/ConfigPage.tsx	Historical tree. Contents not read.
27622	file	archived	not-opened	archives/migration-review/legacy-ui/Consciousness2DA.tsx	Historical tree. Contents not read.
25072	file	archived	not-opened	archives/migration-review/legacy-ui/ConsensusPage.tsx	Historical tree. Contents not read.
7316	file	archived	not-opened	archives/migration-review/legacy-ui/CouncilPage.tsx	Historical tree. Contents not read.
9698	file	archived	not-opened	archives/migration-review/legacy-ui/CrossDimensionalEconomyPage.tsx	Historical tree. Contents not read.
28749	file	archived	not-opened	archives/migration-review/legacy-ui/CurrencyHubPage.tsx	Historical tree. Contents not read.
8947	file	archived	not-opened	archives/migration-review/legacy-ui/DNAHealingPage.tsx	Historical tree. Contents not read.
35533	file	archived	not-opened	archives/migration-review/legacy-ui/DashboardPage.tsx	Historical tree. Contents not read.
25565	file	archived	not-opened	archives/migration-review/legacy-ui/DataSourcesPage.tsx	Historical tree. Contents not read.
31054	file	archived	not-opened	archives/migration-review/legacy-ui/DependencyLearningPage.tsx	Historical tree. Contents not read.
22344	file	archived	not-opened	archives/migration-review/legacy-ui/DimensionalGuardianPage.tsx	Historical tree. Contents not read.
32575	file	archived	not-opened	archives/migration-review/legacy-ui/DimensionalPerceptionPage.tsx	Historical tree. Contents not read.
21974	file	archived	not-opened	archives/migration-review/legacy-ui/DimensionalTravelPortalPage.tsx	Historical tree. Contents not read.
21358	file	archived	not-opened	archives/migration-review/legacy-ui/DiscoveriesPage.tsx	Historical tree. Contents not read.
66195	file	archived	not-opened	archives/migration-review/legacy-ui/EconomyHubPage.tsx	Historical tree. Contents not read.
17627	file	archived	not-opened	archives/migration-review/legacy-ui/EconomyPage.tsx	Historical tree. Contents not read.
26070	file	archived	not-opened	archives/migration-review/legacy-ui/EntitiesPage.tsx	Historical tree. Contents not read.
13648	file	archived	not-opened	archives/migration-review/legacy-ui/FeedbackPage.tsx	Historical tree. Contents not read.
72081	file	archived	not-opened	archives/migration-review/legacy-ui/FleetSynapsePage.tsx	Historical tree. Contents not read.
8068	file	archived	not-opened	archives/migration-review/legacy-ui/FreeLLMRotatorPage.tsx	Historical tree. Contents not read.
31337	file	archived	not-opened	archives/migration-review/legacy-ui/GPUCommandCenterPage.tsx	Historical tree. Contents not read.
25185	file	archived	not-opened	archives/migration-review/legacy-ui/GrandConferencePage.tsx	Historical tree. Contents not read.
30355	file	archived	not-opened	archives/migration-review/legacy-ui/GrandKnowledgeConferencePage.tsx	Historical tree. Contents not read.
30436	file	archived	not-opened	archives/migration-review/legacy-ui/HyperionDashboardPage.tsx	Historical tree. Contents not read.
7935	file	archived	not-opened	archives/migration-review/legacy-ui/ImplementationTrackerPage.tsx	Historical tree. Contents not read.
41176	file	archived	not-opened	archives/migration-review/legacy-ui/IntelligenceEnginePage.tsx	Historical tree. Contents not read.
44932	file	archived	not-opened	archives/migration-review/legacy-ui/InterdimensionalPortalPage.tsx	Historical tree. Contents not read.
68278	file	archived	not-opened	archives/migration-review/legacy-ui/InventionsPage.tsx	Historical tree. Contents not read.
14691	file	archived	not-opened	archives/migration-review/legacy-ui/KnowledgeBasePage.tsx	Historical tree. Contents not read.
14536	file	archived	not-opened	archives/migration-review/legacy-ui/KnowledgeDashboardPage.tsx	Historical tree. Contents not read.
7754	file	archived	not-opened	archives/migration-review/legacy-ui/KnowledgePage.tsx	Historical tree. Contents not read.
14804	file	archived	not-opened	archives/migration-review/legacy-ui/KnowledgePipelinePage.tsx	Historical tree. Contents not read.
68030	file	archived	not-opened	archives/migration-review/legacy-ui/KnowledgeSecretsPage.tsx	Historical tree. Contents not read.
27543	file	archived	not-opened	archives/migration-review/legacy-ui/KnowledgeSynthesisPage.tsx	Historical tree. Contents not read.
29931	file	archived	not-opened	archives/migration-review/legacy-ui/LiberationSystemPage.tsx	Historical tree. Contents not read.
14627	file	archived	not-opened	archives/migration-review/legacy-ui/LiveSecretKnowledgePage.tsx	Historical tree. Contents not read.
27881	file	archived	not-opened	archives/migration-review/legacy-ui/MemoryDashboardPage.tsx	Historical tree. Contents not read.
17616	file	archived	not-opened	archives/migration-review/legacy-ui/MemoryExplorerPage.tsx	Historical tree. Contents not read.
13846	file	archived	not-opened	archives/migration-review/legacy-ui/MeshPage.tsx	Historical tree. Contents not read.
7945	file	archived	not-opened	archives/migration-review/legacy-ui/MoonCyclePage.tsx	Historical tree. Contents not read.
34061	file	archived	not-opened	archives/migration-review/legacy-ui/NLPSelfImprovementPage.tsx	Historical tree. Contents not read.
10252	file	archived	not-opened	archives/migration-review/legacy-ui/NetworkFleetPage.tsx	Historical tree. Contents not read.
7178	file	archived	not-opened	archives/migration-review/legacy-ui/NexusPage.tsx	Historical tree. Contents not read.
26788	file	archived	not-opened	archives/migration-review/legacy-ui/OmniscientKnowledgePage.tsx	Historical tree. Contents not read.
21264	file	archived	not-opened	archives/migration-review/legacy-ui/OverSoulAGIPage.tsx	Historical tree. Contents not read.
13112	file	archived	not-opened	archives/migration-review/legacy-ui/PerformancePage.tsx	Historical tree. Contents not read.
628	file	archived	not-opened	archives/migration-review/legacy-ui/PortalBridgePage.tsx	Historical tree. Contents not read.
10740	file	archived	not-opened	archives/migration-review/legacy-ui/ProviderLeaderboardPage.tsx	Historical tree. Contents not read.
32764	file	archived	not-opened	archives/migration-review/legacy-ui/RealAIConferencePage.tsx	Historical tree. Contents not read.
37978	file	archived	not-opened	archives/migration-review/legacy-ui/ReasoningDashboardPage.tsx	Historical tree. Contents not read.
8749	file	archived	not-opened	archives/migration-review/legacy-ui/RevenueHubPage.tsx	Historical tree. Contents not read.
25665	file	archived	not-opened	archives/migration-review/legacy-ui/SEOPage.tsx	Historical tree. Contents not read.
5239	file	archived	not-opened	archives/migration-review/legacy-ui/SacredTraditionsPage.tsx	Historical tree. Contents not read.
15254	file	archived	not-opened	archives/migration-review/legacy-ui/SandboxPage.tsx	Historical tree. Contents not read.
131688	file	archived	not-opened	archives/migration-review/legacy-ui/SecretSocietyPage.tsx	Historical tree. Contents not read.
14530	file	archived	not-opened	archives/migration-review/legacy-ui/SecretsPage.tsx	Historical tree. Contents not read.
14096	file	archived	not-opened	archives/migration-review/legacy-ui/SecurityAuditPage.tsx	Historical tree. Contents not read.
7953	file	archived	not-opened	archives/migration-review/legacy-ui/SelfHealingPage.tsx	Historical tree. Contents not read.
76257	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignBuildGuidePage.tsx	Historical tree. Contents not read.
18432	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignBuilderPage.tsx	Historical tree. Contents not read.
25783	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignCodecPage.tsx	Historical tree. Contents not read.
36525	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignConsciousnessPage.tsx	Historical tree. Contents not read.
27641	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignDepsPage.tsx	Historical tree. Contents not read.
24744	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignFrameworkPage.tsx	Historical tree. Contents not read.
14714	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignGrandLaunchPage.tsx	Historical tree. Contents not read.
47480	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignHubPage.tsx	Historical tree. Contents not read.
31296	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignInfrastructurePage.tsx	Historical tree. Contents not read.
16858	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignKnowledgePage.tsx	Historical tree. Contents not read.
16547	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignOSPage.tsx	Historical tree. Contents not read.
15780	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignPage.tsx	Historical tree. Contents not read.
28109	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignRulesPage.tsx	Historical tree. Contents not read.
20502	file	archived	not-opened	archives/migration-review/legacy-ui/SovereignSecretsPage.tsx	Historical tree. Contents not read.
51085	file	archived	not-opened	archives/migration-review/legacy-ui/SpiritualAwakeningPage.tsx	Historical tree. Contents not read.
13624	file	archived	not-opened	archives/migration-review/legacy-ui/SportsArbPage.tsx	Historical tree. Contents not read.
51412	file	archived	not-opened	archives/migration-review/legacy-ui/SummitPage.tsx	Historical tree. Contents not read.
21370	file	archived	not-opened	archives/migration-review/legacy-ui/SummitReportPage.tsx	Historical tree. Contents not read.
23570	file	archived	not-opened	archives/migration-review/legacy-ui/SwarmHubPage.tsx	Historical tree. Contents not read.
56164	file	archived	not-opened	archives/migration-review/legacy-ui/TesseractAGIPage.tsx	Historical tree. Contents not read.
14233	file	archived	not-opened	archives/migration-review/legacy-ui/TesseractConsolePage.tsx	Historical tree. Contents not read.
17071	file	archived	not-opened	archives/migration-review/legacy-ui/TesseractLLMPage.tsx	Historical tree. Contents not read.
35012	file	archived	not-opened	archives/migration-review/legacy-ui/TheoremLabPage.tsx	Historical tree. Contents not read.
12481	file	archived	not-opened	archives/migration-review/legacy-ui/TransparencyLedgerPage.tsx	Historical tree. Contents not read.
12118	file	archived	not-opened	archives/migration-review/legacy-ui/UnifiedKnowledgePage.tsx	Historical tree. Contents not read.
20635	file	archived	not-opened	archives/migration-review/legacy-ui/UnifiedTesseractPage.tsx	Historical tree. Contents not read.
38614	file	archived	not-opened	archives/migration-review/legacy-ui/UniversalComputerPage.tsx	Historical tree. Contents not read.
30587	file	archived	not-opened	archives/migration-review/legacy-ui/UniversalConsciousnessPage.tsx	Historical tree. Contents not read.
16302	file	archived	not-opened	archives/migration-review/legacy-ui/UniversalKnowledgePage.tsx	Historical tree. Contents not read.
41245	file	archived	not-opened	archives/migration-review/legacy-ui/UniverseMechanicsPage.tsx	Historical tree. Contents not read.
34106	file	archived	not-opened	archives/migration-review/legacy-ui/UniverseModelPage.tsx	Historical tree. Contents not read.
27959	file	archived	not-opened	archives/migration-review/legacy-ui/VaticanArchivesPage.tsx	Historical tree. Contents not read.
17160	file	archived	not-opened	archives/migration-review/legacy-ui/VoidStoragePage.tsx	Historical tree. Contents not read.
23399	file	archived	not-opened	archives/migration-review/legacy-ui/WalletDashboardPage.tsx	Historical tree. Contents not read.
295529	file	archived	not-opened	archives/source-repositories/1/pnpm-lock.yaml	Historical tree. Contents not read.
4538	file	archived	not-opened	archives/source-repositories/1/pnpm-workspace.yaml	Historical tree. Contents not read.
201430	file	archived	not-opened	archives/source-repositories/5t/.agents/outputs/tx-local-branches-manifest.json	Historical tree. Contents not read.
813	file	archived	not-opened	archives/source-repositories/5t/.agents/outputs/tx-t44-unique/.agents__agent_assets_metadata.toml	Historical tree. Contents not read.
727	file	archived	not-opened	archives/source-repositories/5t/artifacts/api-server/data/audit-manifest.json	Historical tree. Contents not read.
287371	file	archived	not-opened	archives/source-repositories/Grok-ready/docs/migration-review/raw-media-inventory.json	Historical tree. Contents not read.
1922832	file	archived	not-opened	archives/source-repositories/Grok-ready/docs/migration-review/remote-archive-verification.json	Historical tree. Contents not read.
130450	file	archived	not-opened	archives/source-repositories/Grok-ready/docs/migration-review/represented-at-other-paths.json	Historical tree. Contents not read.
1113	file	archived	not-opened	archives/source-repositories/README.md	Historical tree. Contents not read.
791	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/.replit-artifact/artifact.toml	Historical tree. Contents not read.
1339	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/package.json	Historical tree. Contents not read.
3841	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/__tests__/interactive-status.test.ts	Historical tree. Contents not read.
16206	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/__tests__/route-inventory.test.ts	Historical tree. Contents not read.
5914	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/__tests__/tessera-model.test.ts	Historical tree. Contents not read.
8391	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/__tests__/tessera-workspace.test.ts	Historical tree. Contents not read.
33193	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/app.ts	Historical tree. Contents not read.
1252	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/eval/chatbot-cases.ts	Historical tree. Contents not read.
17132	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/index.ts	Historical tree. Contents not read.
2429	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/interactive-app.ts	Historical tree. Contents not read.
1165	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/interactive-index.ts	Historical tree. Contents not read.
943	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/lib/require-father.ts	Historical tree. Contents not read.
9150	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/lib/sovereign-session.ts	Historical tree. Contents not read.
1635	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/lib/tessera-heritage.ts	Historical tree. Contents not read.
7819	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/lib/tessera-model.ts	Historical tree. Contents not read.
1813	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/lib/tessera-study-notes.ts	Historical tree. Contents not read.
1998	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/lib/workspace-connections.ts	Historical tree. Contents not read.
8878	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/routes/admin-session.ts	Historical tree. Contents not read.
7776	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/routes/index.ts	Historical tree. Contents not read.
1270	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/routes/interactive-status.ts	Historical tree. Contents not read.
10289	file	archived	not-opened	archives/source-repositories/Zz/artifacts/api-server/src/routes/tessera-workspace.ts	Historical tree. Contents not read.
1592	file	archived	not-opened	archives/source-repositories/Zz/artifacts/mockup-sandbox/vite.config.ts	Historical tree. Contents not read.
12556	file	archived	not-opened	archives/source-repositories/Zz/artifacts/tessera/src/App.tsx	Historical tree. Contents not read.
10853	file	archived	not-opened	archives/source-repositories/Zz/artifacts/tessera/src/components/MobileNav.tsx	Historical tree. Contents not read.
5260	file	archived	not-opened	archives/source-repositories/Zz/artifacts/tessera/src/components/OwnerSessionGate.tsx	Historical tree. Contents not read.
2938	file	archived	not-opened	archives/source-repositories/Zz/artifacts/tessera/src/components/TesseraIdentityNotice.tsx	Historical tree. Contents not read.
3730	file	archived	not-opened	archives/source-repositories/Zz/artifacts/tessera/src/lib/adminContext.tsx	Historical tree. Contents not read.
11581	file	archived	not-opened	archives/source-repositories/Zz/artifacts/tessera/src/lib/puter-ai.ts	Historical tree. Contents not read.
11339	file	archived	not-opened	archives/source-repositories/Zz/artifacts/tessera/src/pages/ChatPage.tsx	Historical tree. Contents not read.
7445	file	archived	not-opened	archives/source-repositories/Zz/artifacts/tessera/src/pages/ConnectionsPage.tsx	Historical tree. Contents not read.
6126	file	archived	not-opened	archives/source-repositories/Zz/artifacts/tessera/src/pages/InteractiveStatusPage.tsx	Historical tree. Contents not read.
2053	file	archived	not-opened	archives/source-repositories/Zz/artifacts/tessera/src/pages/ModuleStatusPage.tsx	Historical tree. Contents not read.
35	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/.grok/app-env.json	Historical tree. Contents not read.
606	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/.replit-artifact/artifact.toml	Historical tree. Contents not read.
1548	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/drive/8-2-saved.json	Historical tree. Contents not read.
638	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/drive/index-report.json	Historical tree. Contents not read.
61163	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/knowledge/index.json	Historical tree. Contents not read.
407	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/sandbox-runs/our_neuron.rs	Historical tree. Contents not read.
2477	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/school/audit.json	Historical tree. Contents not read.
5800	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/school/cycles.json	Historical tree. Contents not read.
1660	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/school/exam-result.json	Historical tree. Contents not read.
5349	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/school/old-ledger.json	Historical tree. Contents not read.
139	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/school/skills.json	Historical tree. Contents not read.
2732	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/school/wiki.json	Historical tree. Contents not read.
3071	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/tessera-proof.json	Historical tree. Contents not read.
1106	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/tools/connect-notes.mjs	Historical tree. Contents not read.
6499	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/data/web-study.json	Historical tree. Contents not read.
987	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/package.json	Historical tree. Contents not read.
4976	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/app.ts	Historical tree. Contents not read.
7458	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/index.ts	Historical tree. Contents not read.
8221	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/anomaly-detection.ts	Historical tree. Contents not read.
7543	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/auto-recovery.ts	Historical tree. Contents not read.
30930	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/colonial-language-kernel.ts	Historical tree. Contents not read.
33866	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/eval-runner.ts	Historical tree. Contents not read.
6264	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/file-integrity.ts	Historical tree. Contents not read.
15917	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/grand-conference.ts	Historical tree. Contents not read.
4098	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/ingestion/pipeline.ts	Historical tree. Contents not read.
3406	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/ingestion/rss.ts	Historical tree. Contents not read.
5448	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/ingestion/scheduler.ts	Historical tree. Contents not read.
2335	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/ingestion/scrapers.ts	Historical tree. Contents not read.
4643	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/lattice-frequency-bands.ts	Historical tree. Contents not read.
427	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/mesh-auth.ts	Historical tree. Contents not read.
795	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/mesh-bus.ts	Historical tree. Contents not read.
5688	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/provider-registry.ts	Historical tree. Contents not read.
9121	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/reverse-engineering-engine.ts	Historical tree. Contents not read.
4811	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/secureExternalWrapper.ts	Historical tree. Contents not read.
6725	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/session-mesh.ts	Historical tree. Contents not read.
10753	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/sovereign-astro.ts	Historical tree. Contents not read.
10776	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/sovereign-economics.ts	Historical tree. Contents not read.
13472	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/sovereign-harmonics.ts	Historical tree. Contents not read.
8174	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/sovereignty-monitor.ts	Historical tree. Contents not read.
8760	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/lib/vector-memory.ts	Historical tree. Contents not read.
10620	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/conversations.ts	Historical tree. Contents not read.
19991	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/council-meeting.ts	Historical tree. Contents not read.
7159	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/council.ts	Historical tree. Contents not read.
4982	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/diagnostics.ts	Historical tree. Contents not read.
15042	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/evaluation.ts	Historical tree. Contents not read.
12698	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/fleet-synapse.ts	Historical tree. Contents not read.
6370	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/forum.ts	Historical tree. Contents not read.
13562	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/improvement.ts	Historical tree. Contents not read.
2063	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/index.ts	Historical tree. Contents not read.
9784	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/ingestion.ts	Historical tree. Contents not read.
25024	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/inventions.ts	Historical tree. Contents not read.
6011	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/lattice-hardware.ts	Historical tree. Contents not read.
6940	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/memory.ts	Historical tree. Contents not read.
7118	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/provider-sovereignty.ts	Historical tree. Contents not read.
8482	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/security-defense.ts	Historical tree. Contents not read.
33979	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/sovereign-data.ts	Historical tree. Contents not read.
10898	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/swarm.ts	Historical tree. Contents not read.
1370	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/api-server/src/routes/world.ts	Historical tree. Contents not read.
646	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/index.html	Historical tree. Contents not read.
2846	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/package.json	Historical tree. Contents not read.
20515	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/App.tsx	Historical tree. Contents not read.
23975	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/components/AISwarmTab.tsx	Historical tree. Contents not read.
140790	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/components/ChatArea.tsx	Historical tree. Contents not read.
1756	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/components/MeshStatusBadge.tsx	Historical tree. Contents not read.
9615	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/components/MobileNav.tsx	Historical tree. Contents not read.
23410	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/components/Sidebar.tsx	Historical tree. Contents not read.
23169	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/components/ToroidalBackground.tsx	Historical tree. Contents not read.
738	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/components/chat/ChatColorizedText.tsx	Historical tree. Contents not read.
15427	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/components/chat/ChatMessageItem.tsx	Historical tree. Contents not read.
20089	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/hooks/use-chat.ts	Historical tree. Contents not read.
1968	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/hooks/use-repos.ts	Historical tree. Contents not read.
11148	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/index.css	Historical tree. Contents not read.
6893	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/lib/adminContext.tsx	Historical tree. Contents not read.
11424	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/lib/meshContext.tsx	Historical tree. Contents not read.
2822	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/lib/queryClient.ts	Historical tree. Contents not read.
43051	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/lib/sovereign-charts.tsx	Historical tree. Contents not read.
51912	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/AgentNFTPage.tsx	Historical tree. Contents not read.
1336	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/ChatPage.tsx	Historical tree. Contents not read.
22170	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/CommandCenterPage.tsx	Historical tree. Contents not read.
17668	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/ConclusionsPage.tsx	Historical tree. Contents not read.
53629	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/ConsciousnessNexusPage.tsx	Historical tree. Contents not read.
42902	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/CrossAppBridgePage.tsx	Historical tree. Contents not read.
329663	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/GrandCouncilPage.tsx	Historical tree. Contents not read.
156025	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/LatticeBrowserPage.tsx	Historical tree. Contents not read.
19875	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/LifePage.tsx	Historical tree. Contents not read.
67502	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/RecruitmentPage.tsx	Historical tree. Contents not read.
24799	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/RulesPage.tsx	Historical tree. Contents not read.
28105	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/SovereignRulesPage.tsx	Historical tree. Contents not read.
40641	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/SovereigntyDashboardPage.tsx	Historical tree. Contents not read.
22510	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/SovereigntyRoadmapPage.tsx	Historical tree. Contents not read.
33266	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/SystemPage.tsx	Historical tree. Contents not read.
27982	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/TesseraBiblePage.tsx	Historical tree. Contents not read.
72413	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/TesseractForumPage.tsx	Historical tree. Contents not read.
11815	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/ActivityFeed.tsx	Historical tree. Contents not read.
28538	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/AgentProfile.tsx	Historical tree. Contents not read.
37814	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/AgentsListTab.tsx	Historical tree. Contents not read.
99546	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/CommunityTab.tsx	Historical tree. Contents not read.
45666	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/CourtTab.tsx	Historical tree. Contents not read.
7087	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/EventsTab.tsx	Historical tree. Contents not read.
29639	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/GovernanceTab.tsx	Historical tree. Contents not read.
10158	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/InteractTab.tsx	Historical tree. Contents not read.
32774	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/JailWorkCampPanel.tsx	Historical tree. Contents not read.
29300	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/JobBoardTab.tsx	Historical tree. Contents not read.
11355	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/src/pages/life/types.ts	Historical tree. Contents not read.
520	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/tsconfig.json	Historical tree. Contents not read.
1831	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/artifacts/tessera/vite.config.ts	Historical tree. Contents not read.
346	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/drizzle/meta/_journal.json	Historical tree. Contents not read.
2047	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/src/schema/conversations.ts	Historical tree. Contents not read.
307	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/src/schema/index.ts	Historical tree. Contents not read.
3315	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/src/schema/inventions.ts	Historical tree. Contents not read.
6426	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/src/schema/phases-8-12.ts	Historical tree. Contents not read.
3252	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/src/schema/reasoning.ts	Historical tree. Contents not read.
2171	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/lib/db/src/schema/system.ts	Historical tree. Contents not read.
246303	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/pnpm-lock.yaml	Historical tree. Contents not read.
6560	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/shared-lfs-zip/3/pnpm-workspace.yaml	Historical tree. Contents not read.
5256	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/generate2dmap/scripts/compose_layered_preview.py	Historical tree. Contents not read.
13050	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/generate2dmap/scripts/extract_prop_pack.py	Historical tree. Contents not read.
42687	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/generate2dsprite/scripts/generate2dsprite.py	Historical tree. Contents not read.
3590	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/generate2dsprite/scripts/make_layout_guide.py	Historical tree. Contents not read.
16164	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/.grok/skills/video2dsprite/scripts/video2dsprite.py	Historical tree. Contents not read.
2739	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/migrations/0001_auth.sql	Historical tree. Contents not read.
1664	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/migrations/0002_store.sql	Historical tree. Contents not read.
1035	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/migrations/0003_promos.sql	Historical tree. Contents not read.
792	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/migrations/0004_credits.sql	Historical tree. Contents not read.
830	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/migrations/0005_optimizer.sql	Historical tree. Contents not read.
463	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/migrations/0006_affiliate.sql	Historical tree. Contents not read.
425	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/migrations/0007_wholesale_affiliate.sql	Historical tree. Contents not read.
262769	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/package-lock.json	Historical tree. Contents not read.
191	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-complete-archives--grok-workspace_1789591148371/startup.sh	Historical tree. Contents not read.
479479	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-unified-main/pnpm-lock.yaml	Historical tree. Contents not read.
5318	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/imports/trees/tessera-unified-main/pnpm-workspace.yaml	Historical tree. Contents not read.
1244	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/index.html	Historical tree. Contents not read.
3464	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/package.json	Historical tree. Contents not read.
309	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/app-path.mjs	Historical tree. Contents not read.
1108	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/ask-her.ts	Historical tree. Contents not read.
438	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/colonel.test.mjs	Historical tree. Contents not read.
5802	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/drive-chunks.py	Historical tree. Contents not read.
3852	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/drive-index.py	Historical tree. Contents not read.
2334	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/exam-her.ts	Historical tree. Contents not read.
18225	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/grok-pwa-shared.mjs	Historical tree. Contents not read.
310	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/own-lab.test.mjs	Historical tree. Contents not read.
381	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/recall-check.ts	Historical tree. Contents not read.
368	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/recall.test.mjs	Historical tree. Contents not read.
1229	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/run-audit.ts	Historical tree. Contents not read.
808	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/run-neuro-workaround.py	Historical tree. Contents not read.
536	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/run-tool.mjs	Historical tree. Contents not read.
682	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/sdk.test.mjs	Historical tree. Contents not read.
10062	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/study-step.mjs	Historical tree. Contents not read.
7463	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/ten-cycles.mjs	Historical tree. Contents not read.
9242	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/scripts/tessera-worker.mjs	Historical tree. Contents not read.
5075	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/app-shell.tsx	Historical tree. Contents not read.
10474	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/chamber.tsx	Historical tree. Contents not read.
4801	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/code-view.tsx	Historical tree. Contents not read.
1652	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/colonel-panel.tsx	Historical tree. Contents not read.
5930	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/conversations-view.tsx	Historical tree. Contents not read.
10680	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/council-room.tsx	Historical tree. Contents not read.
4189	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/ingest-panel.tsx	Historical tree. Contents not read.
6972	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/language-view.tsx	Historical tree. Contents not read.
5152	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/lattice.tsx	Historical tree. Contents not read.
18406	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/learn-view.tsx	Historical tree. Contents not read.
7906	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/living-loop.tsx	Historical tree. Contents not read.
3256	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/memory-view.tsx	Historical tree. Contents not read.
5821	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/narrative-view.tsx	Historical tree. Contents not read.
2513	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/own-lab-view.tsx	Historical tree. Contents not read.
2701	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/proof-panel.tsx	Historical tree. Contents not read.
3471	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/pulse-view.tsx	Historical tree. Contents not read.
16210	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/self-view.tsx	Historical tree. Contents not read.
6445	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/simulation.tsx	Historical tree. Contents not read.
4579	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/components/tessera/world-stage.tsx	Historical tree. Contents not read.
1628	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/auth/preview.ts	Historical tree. Contents not read.
10726	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/chat.ts	Historical tree. Contents not read.
3004	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/conference.ts	Historical tree. Contents not read.
5483	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/constitution-seal.ts	Historical tree. Contents not read.
220	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/data-path.ts	Historical tree. Contents not read.
10968	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/desk.ts	Historical tree. Contents not read.
5521	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/grok-ready.ts	Historical tree. Contents not read.
15749	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/identity.ts	Historical tree. Contents not read.
4959	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/ingest.ts	Historical tree. Contents not read.
1511	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/lab-run.ts	Historical tree. Contents not read.
5397	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/learning.ts	Historical tree. Contents not read.
5770	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/line-reading.ts	Historical tree. Contents not read.
11427	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/narrative.ts	Historical tree. Contents not read.
16926	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/prompt.ts	Historical tree. Contents not read.
2158	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/proof.ts	Historical tree. Contents not read.
3923	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/recall.ts	Historical tree. Contents not read.
4740	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/repo-delta.ts	Historical tree. Contents not read.
11566	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/store.ts	Historical tree. Contents not read.
9471	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/study.ts	Historical tree. Contents not read.
852	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/lib/tessera/tools.ts	Historical tree. Contents not read.
1741	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/routeTree.gen.ts	Historical tree. Contents not read.
1377	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/src/styles.css	Historical tree. Contents not read.
707	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/startup.sh	Historical tree. Contents not read.
70	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/vercel.json	Historical tree. Contents not read.
6745	file	archived	not-opened	archives/source-repositories/Zz/artifacts/z-app/vite.config.ts	Historical tree. Contents not read.
267	file	archived	not-opened	archives/source-repositories/Zz/lib/api-client-react/tsconfig.json	Historical tree. Contents not read.
8249	file	archived	not-opened	archives/source-repositories/Zz/lib/api-spec/openapi.yaml	Historical tree. Contents not read.
1906	file	archived	not-opened	archives/source-repositories/Zz/lib/api-spec/orval.config.ts	Historical tree. Contents not read.
101	file	archived	not-opened	archives/source-repositories/Zz/lib/api-zod/src/index.ts	Historical tree. Contents not read.
649	file	archived	not-opened	archives/source-repositories/Zz/package.json	Historical tree. Contents not read.
426247	file	archived	not-opened	archives/source-repositories/Zz/pnpm-lock.yaml	Historical tree. Contents not read.
6674	file	archived	not-opened	archives/source-repositories/Zz/pnpm-workspace.yaml	Historical tree. Contents not read.
178415	file	archived	not-opened	archives/source-repositories/Zz/tessera-control/canonical/source-files.json	Historical tree. Contents not read.
692	file	archived	not-opened	archives/source-repositories/Zz/tsconfig.base.json	Historical tree. Contents not read.
76	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/.grok/app-env.json	Historical tree. Contents not read.
20123	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/coordination/board.json	Historical tree. Contents not read.
199933	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/imports/manifest.json	Historical tree. Contents not read.
177196	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/imports/read.json	Historical tree. Contents not read.
940	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/school/audit.json	Historical tree. Contents not read.
85	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/school/pen-slot.json	Historical tree. Contents not read.
172	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/school/skills.json	Historical tree. Contents not read.
3356	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/tessera-proof.json	Historical tree. Contents not read.
4504	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/tools/workshop-pass.mjs	Historical tree. Contents not read.
6098	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/web-study.json	Historical tree. Contents not read.
97	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/workshop/replit-plugin/mcp.json	Historical tree. Contents not read.
311	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/data/workshop/replit-plugin/plugin.json	Historical tree. Contents not read.
264665	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/package-lock.json	Historical tree. Contents not read.
3546	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/package.json	Historical tree. Contents not read.
607	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/scripts/chamber-cycle.test.mjs	Historical tree. Contents not read.
1117	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/scripts/desk-study.mjs	Historical tree. Contents not read.
455	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/scripts/github-desk.test.mjs	Historical tree. Contents not read.
1630	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/scripts/import-pass.test.mjs	Historical tree. Contents not read.
391	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/scripts/import-recall.test.mjs	Historical tree. Contents not read.
661	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/scripts/imported-laws.test.mjs	Historical tree. Contents not read.
854	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/scripts/recall.test.mjs	Historical tree. Contents not read.
10135	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/scripts/tessera-worker.mjs	Historical tree. Contents not read.
5450	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/src/components/tessera/app-shell.tsx	Historical tree. Contents not read.
13496	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/src/components/tessera/board-view.tsx	Historical tree. Contents not read.
13964	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/src/components/tessera/chamber.tsx	Historical tree. Contents not read.
4776	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/src/components/tessera/code-view.tsx	Historical tree. Contents not read.
6477	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/src/components/tessera/world-stage.tsx	Historical tree. Contents not read.
17450	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/src/lib/tessera/chat.ts	Historical tree. Contents not read.
12314	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/src/lib/tessera/github-desk.ts	Historical tree. Contents not read.
15215	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/src/lib/tessera/identity.ts	Historical tree. Contents not read.
1102	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/startup.sh	Historical tree. Contents not read.
6750	file	archived	not-opened	archives/source-repositories/olive-giant-ever-glade/vite.config.ts	Historical tree. Contents not read.
16749	file	archived	not-opened	archives/source-variants/1/main/artifacts/api-server/src/__tests__/invention-glb-upload.test.ts	Historical tree. Contents not read.
1102	file	archived	not-opened	archives/source-variants/1/main/artifacts/api-server/src/__tests__/moltbook-sandbox-boundary.test.ts	Historical tree. Contents not read.
3307	file	archived	not-opened	archives/source-variants/1/main/artifacts/api-server/src/lib/safe-fetch.ts	Historical tree. Contents not read.
3608	file	archived	not-opened	archives/source-variants/1/main/artifacts/api-server/src/lib/sovereign-fetch-guard.ts	Historical tree. Contents not read.
106073	file	archived	not-opened	archives/source-variants/1/main/artifacts/api-server/src/routes/inventions.ts	Historical tree. Contents not read.
177	file	archived	not-opened	archives/source-variants/5t/main/.agents/memory/MEMORY.md	Historical tree. Contents not read.
74	file	archived	not-opened	archives/source-variants/5t/main/.gitattributes	Historical tree. Contents not read.
938	file	archived	not-opened	archives/source-variants/5t/main/.gitignore	Historical tree. Contents not read.
1984	file	archived	not-opened	archives/source-variants/5t/main/MIGRATION_TO_GROK_READY.md	Historical tree. Contents not read.
30220	file	archived	not-opened	archives/source-variants/5t/main/artifacts/api-server/src/app.ts	Historical tree. Contents not read.
40549	file	archived	not-opened	archives/source-variants/5t/main/artifacts/api-server/src/lib/eval-runner.ts	Historical tree. Contents not read.
11781	file	archived	not-opened	archives/source-variants/5t/main/artifacts/api-server/src/lib/ingestion/pipeline.ts	Historical tree. Contents not read.
30749	file	archived	not-opened	archives/source-variants/5t/main/artifacts/api-server/src/lib/ingestion/scheduler.ts	Historical tree. Contents not read.
19235	file	archived	not-opened	archives/source-variants/5t/main/artifacts/api-server/src/lib/tessera-codex.ts	Historical tree. Contents not read.
7435	file	archived	not-opened	archives/source-variants/5t/main/artifacts/api-server/src/routes/index.ts	Historical tree. Contents not read.
60	file	archived	not-opened	archives/source-variants/Everything/main/README.md	Historical tree. Contents not read.
1468	file	archived	not-opened	archives/source-variants/T44/main/.agents/agent_assets_metadata.toml	Historical tree. Contents not read.
296	file	archived	not-opened	archives/source-variants/T44/main/.agents/memory/MEMORY.md	Historical tree. Contents not read.
1034	file	archived	not-opened	archives/source-variants/T44/main/.agents/memory/agent-identity-boundary.md	Historical tree. Contents not read.
1087	file	archived	not-opened	archives/source-variants/T44/main/.agents/memory/repository-migration-policy.md	Historical tree. Contents not read.
841	file	archived	not-opened	archives/source-variants/T44/main/.gitignore	Historical tree. Contents not read.
26495	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/app.ts	Historical tree. Contents not read.
16941	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/index.ts	Historical tree. Contents not read.
32890	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/lib/consensus-engine.ts	Historical tree. Contents not read.
1703	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/lib/father-verify-throttle.ts	Historical tree. Contents not read.
7135	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/lib/forum-identity-registry.ts	Historical tree. Contents not read.
1893	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/lib/moltbook-bridge.ts	Historical tree. Contents not read.
33652	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/lib/sovereign-loop.ts	Historical tree. Contents not read.
18043	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/lib/sovereign-society.ts	Historical tree. Contents not read.
5209	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/agi.ts	Historical tree. Contents not read.
4646	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/compression.ts	Historical tree. Contents not read.
31104	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/council.ts	Historical tree. Contents not read.
2484	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/departments.ts	Historical tree. Contents not read.
8340	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/diagnostics.ts	Historical tree. Contents not read.
4559	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/evolution-health.ts	Historical tree. Contents not read.
9125	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/father-key-conference.ts	Historical tree. Contents not read.
13808	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/fleet-synapse.ts	Historical tree. Contents not read.
42360	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/forum.ts	Historical tree. Contents not read.
6463	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/grand-evolution.ts	Historical tree. Contents not read.
7173	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/index.ts	Historical tree. Contents not read.
105338	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/inventions.ts	Historical tree. Contents not read.
15514	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/legacy-engines.ts	Historical tree. Contents not read.
8554	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/provider-sovereignty.ts	Historical tree. Contents not read.
3715	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/reality-audit.ts	Historical tree. Contents not read.
10857	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/secret-knowledge.ts	Historical tree. Contents not read.
46769	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/sovereign-data.ts	Historical tree. Contents not read.
29310	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/sovereign-doctrine.ts	Historical tree. Contents not read.
9264	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/sovereign-engines.ts	Historical tree. Contents not read.
7230	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/storage.ts	Historical tree. Contents not read.
10520	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/swarm.ts	Historical tree. Contents not read.
6363	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/tessera-codex.ts	Historical tree. Contents not read.
7090	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/training-evolution.ts	Historical tree. Contents not read.
8989	file	archived	not-opened	archives/source-variants/T44/main/artifacts/api-server/src/routes/universe.ts	Historical tree. Contents not read.
17641	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/App.tsx	Historical tree. Contents not read.
64757	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/components/ChatArea.tsx	Historical tree. Contents not read.
22838	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/components/Sidebar.tsx	Historical tree. Contents not read.
14313	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/components/TesseractKeyGate.tsx	Historical tree. Contents not read.
7301	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/components/chat/ChatInputToolbar.tsx	Historical tree. Contents not read.
17954	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/components/chat/ChatMessageItem.tsx	Historical tree. Contents not read.
8125	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/components/chat/ChatMessageList.tsx	Historical tree. Contents not read.
6921	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/components/chat/ChatVoiceModeOverlay.tsx	Historical tree. Contents not read.
6371	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/lib/queryClient.ts	Historical tree. Contents not read.
18417	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/pages/CodexPage.tsx	Historical tree. Contents not read.
15102	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/pages/DepartmentsPage.tsx	Historical tree. Contents not read.
9045	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/pages/RoyalRolePage.tsx	Historical tree. Contents not read.
36034	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/pages/SacredConferencePage.tsx	Historical tree. Contents not read.
17981	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/pages/SettingsPage.tsx	Historical tree. Contents not read.
20883	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/pages/SovereigntyDashboardPage.tsx	Historical tree. Contents not read.
25824	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/pages/SovereigntyReadinessPage.tsx	Historical tree. Contents not read.
8887	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/pages/SwarmVisualizationPage.tsx	Historical tree. Contents not read.
30272	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/pages/SystemPage.tsx	Historical tree. Contents not read.
94884	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/pages/TesseractForumPage.tsx	Historical tree. Contents not read.
11337	file	archived	not-opened	archives/source-variants/T44/main/artifacts/tessera/src/types/api.ts	Historical tree. Contents not read.
5331	file	archived	not-opened	archives/source-variants/TX/main/AGENTS.md	Historical tree. Contents not read.
440	file	archived	not-opened	archives/source-variants/TX/main/README.md	Historical tree. Contents not read.
2045	file	archived	not-opened	archives/source-variants/tessera-complete-archives/main/README.md	Historical tree. Contents not read.
272	file	archived	not-opened	archives/source-variants/tessera-complete-archives/main/archives.sha256	Historical tree. Contents not read.
4079	file	archived	not-opened	archives/source-variants/tessera-grok-handoff-complete/main/README.md	Historical tree. Contents not read.
272	file	archived	not-opened	archives/source-variants/tessera-grok-handoff-complete/main/archives.sha256	Historical tree. Contents not read.
10682	file	archived	not-opened	archives/source-variants/tessera-grok-handoff/main/README.md	Historical tree. Contents not read.
46	file	live code	not-opened	artifacts/api-server/.gitignore	Tessera API server file. Contents not read.
1041	file	live code	not-opened	artifacts/api-server/.replit-artifact/artifact.toml	Tessera API server file. Contents not read.
3524	file	live code	not-opened	artifacts/api-server/build.mjs	Tessera API server file. Contents not read.
397	file	live code	not-opened	artifacts/api-server/eslint.config.mjs	Tessera API server file. Contents not read.
216	file	live code	not-opened	artifacts/api-server/eval-baseline.json	Tessera API server file. Contents not read.
394	file	live code	not-opened	artifacts/api-server/lint-baseline.json	Tessera API server file. Contents not read.
1707	file	live code	opened	artifacts/api-server/package.json	API package scripts and dependencies, including cookie-parser.
40282	file	live code	not-opened	artifacts/api-server/scripts/convene-natal-key-conference.mjs	Tessera API server file. Contents not read.
5621	file	live code	not-opened	artifacts/api-server/scripts/eval-chatbot.ts	Tessera API server file. Contents not read.
2609	file	live code	not-opened	artifacts/api-server/scripts/eval-gate.mjs	Tessera API server file. Contents not read.
2063	file	live code	not-opened	artifacts/api-server/scripts/eval-gate.nodetest.mjs	Tessera API server file. Contents not read.
1210	file	live code	not-opened	artifacts/api-server/scripts/pen-local-gate.mjs	Tessera API server file. Contents not read.
7624	file	live code	not-opened	artifacts/api-server/scripts/privacy-e-cleanup.mjs	Tessera API server file. Contents not read.
18200	file	live code	not-opened	artifacts/api-server/scripts/run-improvement-conference.mjs	Tessera API server file. Contents not read.
13966	file	live code	not-opened	artifacts/api-server/scripts/run-real-conference.mjs	Tessera API server file. Contents not read.
241	file	live code	not-opened	artifacts/api-server/src/__fixtures__/sandbox-target.js	Tessera API server file. Contents not read.
8207	file	live code	not-opened	artifacts/api-server/src/__tests__/access-log-url.test.ts	API server test. Contents not read.
18156	file	live code	not-opened	artifacts/api-server/src/__tests__/admin-key-hash-logs.test.ts	API server test. Contents not read.
1977	file	live code	not-opened	artifacts/api-server/src/__tests__/admin-session-denial-log.test.ts	API server test. Contents not read.
5563	file	live code	not-opened	artifacts/api-server/src/__tests__/admission-empathy-training.test.ts	API server test. Contents not read.
8250	file	live code	not-opened	artifacts/api-server/src/__tests__/admission-gate.test.ts	API server test. Contents not read.
2898	file	live code	not-opened	artifacts/api-server/src/__tests__/admission-issue-349.test.ts	API server test. Contents not read.
5723	file	live code	not-opened	artifacts/api-server/src/__tests__/admission-registry.test.ts	API server test. Contents not read.
9730	file	live code	not-opened	artifacts/api-server/src/__tests__/admission-self-improvement.test.ts	API server test. Contents not read.
1406	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-checkpoint.test.ts	API server test. Contents not read.
2122	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-global-workspace-redundant.test.ts	API server test. Contents not read.
1739	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-global-workspace.test.ts	API server test. Contents not read.
1040	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-hebbian.test.ts	API server test. Contents not read.
1029	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-hybrid-search.test.ts	API server test. Contents not read.
12565	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-improvement-gate.test.ts	API server test. Contents not read.
1974	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-memory-writer.test.ts	API server test. Contents not read.
3197	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-reflection.test.ts	API server test. Contents not read.
3384	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-stream-xff.test.ts	API server test. Contents not read.
9229	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-stream.test.ts	API server test. Contents not read.
2052	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-subgoaling.test.ts	API server test. Contents not read.
1288	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-temporal-facts.test.ts	API server test. Contents not read.
1311	file	live code	not-opened	artifacts/api-server/src/__tests__/agi-tiered-memory.test.ts	API server test. Contents not read.
7584	file	live code	not-opened	artifacts/api-server/src/__tests__/astro-sigil-key-vectors.test.ts	API server test. Contents not read.
5126	file	live code	not-opened	artifacts/api-server/src/__tests__/bus-history.test.ts	API server test. Contents not read.
5041	file	live code	not-opened	artifacts/api-server/src/__tests__/chamber-learning.test.ts	API server test. Contents not read.
3691	file	live code	not-opened	artifacts/api-server/src/__tests__/chat-collab.test.ts	API server test. Contents not read.
5038	file	live code	not-opened	artifacts/api-server/src/__tests__/chat-generation.test.ts	API server test. Contents not read.
9927	file	live code	not-opened	artifacts/api-server/src/__tests__/chat-llm-loopback.test.ts	API server test. Contents not read.
13995	file	live code	not-opened	artifacts/api-server/src/__tests__/colonial-language-gate.test.ts	API server test. Contents not read.
13967	file	live code	not-opened	artifacts/api-server/src/__tests__/colonial-secret-fail-closed.test.ts	API server test. Contents not read.
7493	file	live code	not-opened	artifacts/api-server/src/__tests__/colonial-sovereign-language-admin-gate.test.ts	API server test. Contents not read.
1123	file	live code	not-opened	artifacts/api-server/src/__tests__/comms-policy.test.ts	API server test. Contents not read.
4891	file	live code	not-opened	artifacts/api-server/src/__tests__/compression-pipeline.test.ts	API server test. Contents not read.
1590	file	live code	not-opened	artifacts/api-server/src/__tests__/conversation-impersonation.test.ts	API server test. Contents not read.
7477	file	live code	not-opened	artifacts/api-server/src/__tests__/conversations-delete-owner-gate.test.ts	API server test. Contents not read.
5858	file	live code	not-opened	artifacts/api-server/src/__tests__/db-optional-boot.test.ts	API server test. Contents not read.
2003	file	live code	not-opened	artifacts/api-server/src/__tests__/deterministic-selectors.test.ts	API server test. Contents not read.
3834	file	live code	not-opened	artifacts/api-server/src/__tests__/doctrine-ingestion.test.ts	API server test. Contents not read.
5960	file	live code	not-opened	artifacts/api-server/src/__tests__/dual-brain-cycle.test.ts	API server test. Contents not read.
1461	file	live code	not-opened	artifacts/api-server/src/__tests__/dual-brain-readiness.test.ts	API server test. Contents not read.
7404	file	live code	not-opened	artifacts/api-server/src/__tests__/embed-text-signed.test.ts	API server test. Contents not read.
1018	file	live code	not-opened	artifacts/api-server/src/__tests__/eval-chatbot-cases.test.ts	API server test. Contents not read.
4350	file	live code	not-opened	artifacts/api-server/src/__tests__/eval-runner-os-metrics.test.ts	API server test. Contents not read.
5016	file	live code	not-opened	artifacts/api-server/src/__tests__/evolution-health-admin-gate.test.ts	API server test. Contents not read.
5516	file	live code	not-opened	artifacts/api-server/src/__tests__/evolution-health-controls.test.ts	API server test. Contents not read.
6118	file	live code	not-opened	artifacts/api-server/src/__tests__/evolution-module-health.test.ts	API server test. Contents not read.
11108	file	live code	not-opened	artifacts/api-server/src/__tests__/evolution-sandbox-loop.test.ts	API server test. Contents not read.
13819	file	live code	not-opened	artifacts/api-server/src/__tests__/father-fingerprint-not-in-responses.test.ts	API server test. Contents not read.
3875	file	live code	not-opened	artifacts/api-server/src/__tests__/followup-350-351.test.ts	API server test. Contents not read.
4484	file	live code	not-opened	artifacts/api-server/src/__tests__/forum-identity-registry-logs.test.ts	API server test. Contents not read.
1521	file	live code	not-opened	artifacts/api-server/src/__tests__/forum-member-token-limit.test.ts	API server test. Contents not read.
41514	file	live code	not-opened	artifacts/api-server/src/__tests__/forum-member-token.test.ts	API server test. Contents not read.
11542	file	live code	not-opened	artifacts/api-server/src/__tests__/forum-mesh-hash.test.ts	API server test. Contents not read.
13565	file	live code	not-opened	artifacts/api-server/src/__tests__/forum-no-err-message.test.ts	API server test. Contents not read.
7133	file	live code	not-opened	artifacts/api-server/src/__tests__/generic-500-grand-council-omniversal.test.ts	API server test. Contents not read.
69889	file	live code	not-opened	artifacts/api-server/src/__tests__/github-desk-owner-gate.test.ts	API server test. Contents not read.
7432	file	live code	not-opened	artifacts/api-server/src/__tests__/gm1-secfix.test.ts	API server test. Contents not read.
17621	file	live code	not-opened	artifacts/api-server/src/__tests__/governance-consensus-gate.test.ts	API server test. Contents not read.
6075	file	live code	not-opened	artifacts/api-server/src/__tests__/grand-conference-cipher-errors.test.ts	API server test. Contents not read.
11856	file	live code	not-opened	artifacts/api-server/src/__tests__/guarded-llm-nasa-fetch.test.ts	API server test. Contents not read.
1386	file	live code	not-opened	artifacts/api-server/src/__tests__/healthz.test.ts	API server test. Contents not read.
2257	file	live code	not-opened	artifacts/api-server/src/__tests__/heavy-council-directives.test.ts	API server test. Contents not read.
17003	file	live code	not-opened	artifacts/api-server/src/__tests__/heldout-answer-key.test.ts	API server test. Contents not read.
1284	file	live code	not-opened	artifacts/api-server/src/__tests__/helpers/parse3dobj.ts	API server test. Contents not read.
7242	file	live code	not-opened	artifacts/api-server/src/__tests__/hybrid-bm25-df.test.ts	API server test. Contents not read.
3584	file	live code	not-opened	artifacts/api-server/src/__tests__/hybrid-rerank-batch.test.ts	API server test. Contents not read.
1921	file	live code	not-opened	artifacts/api-server/src/__tests__/identity-drift.test.ts	API server test. Contents not read.
7909	file	live code	not-opened	artifacts/api-server/src/__tests__/identity-source.test.ts	API server test. Contents not read.
8342	file	live code	not-opened	artifacts/api-server/src/__tests__/improvement-conference.test.ts	API server test. Contents not read.
6523	file	live code	not-opened	artifacts/api-server/src/__tests__/income-cold-gets.test.ts	API server test. Contents not read.
1264	file	live code	not-opened	artifacts/api-server/src/__tests__/income-executor-logs.test.ts	API server test. Contents not read.
5848	file	live code	not-opened	artifacts/api-server/src/__tests__/income-leads-generic-errors.test.ts	API server test. Contents not read.
1652	file	live code	not-opened	artifacts/api-server/src/__tests__/ingestion-quiet-backoff.test.ts	API server test. Contents not read.
1342	file	live code	not-opened	artifacts/api-server/src/__tests__/ingestion-run-lock-lease.test.ts	API server test. Contents not read.
16324	file	live code	not-opened	artifacts/api-server/src/__tests__/install-id-and-vault-failures.test.ts	API server test. Contents not read.
18558	file	live code	not-opened	artifacts/api-server/src/__tests__/invention-glb-upload.test.ts	API server test. Contents not read.
5413	file	live code	not-opened	artifacts/api-server/src/__tests__/invention-seed.test.ts	API server test. Contents not read.
6263	file	live code	not-opened	artifacts/api-server/src/__tests__/learning-memory.test.ts	API server test. Contents not read.
19372	file	live code	not-opened	artifacts/api-server/src/__tests__/legacy-engines-admin-gate.test.ts	API server test. Contents not read.
4350	file	live code	not-opened	artifacts/api-server/src/__tests__/legacy-engines-no-autostart.test.ts	API server test. Contents not read.
3289	file	live code	not-opened	artifacts/api-server/src/__tests__/logger-err-serializer.test.ts	API server test. Contents not read.
4106	file	live code	not-opened	artifacts/api-server/src/__tests__/mesh-generic-500.test.ts	API server test. Contents not read.
23803	file	live code	not-opened	artifacts/api-server/src/__tests__/mesh-registry.test.ts	API server test. Contents not read.
16750	file	live code	not-opened	artifacts/api-server/src/__tests__/mesh-socket-authz.test.ts	API server test. Contents not read.
2005	file	live code	not-opened	artifacts/api-server/src/__tests__/metacognition-type-import.test.ts	API server test. Contents not read.
1085	file	live code	not-opened	artifacts/api-server/src/__tests__/moltbook-sandbox-boundary.test.ts	API server test. Contents not read.
1700	file	live code	not-opened	artifacts/api-server/src/__tests__/neural-embeddings.test.ts	API server test. Contents not read.
2586	file	live code	not-opened	artifacts/api-server/src/__tests__/next-five-improvements.test.ts	API server test. Contents not read.
3626	file	live code	not-opened	artifacts/api-server/src/__tests__/object-storage-normalize.test.ts	API server test. Contents not read.
1391	file	live code	not-opened	artifacts/api-server/src/__tests__/operational-status.test.ts	API server test. Contents not read.
5358	file	live code	not-opened	artifacts/api-server/src/__tests__/orphan-lib-modules.test.ts	API server test. Contents not read.
37829	file	live code	not-opened	artifacts/api-server/src/__tests__/pen-local.test.ts	API server test. Contents not read.
3588	file	live code	not-opened	artifacts/api-server/src/__tests__/placement-literal-guard.test.ts	API server test. Contents not read.
7854	file	live code	not-opened	artifacts/api-server/src/__tests__/privacy-e-cleanup.test.ts	API server test. Contents not read.
2704	file	live code	not-opened	artifacts/api-server/src/__tests__/privacy-e-error-bodies.test.ts	API server test. Contents not read.
19184	file	live code	not-opened	artifacts/api-server/src/__tests__/privacy-e-limiters.test.ts	API server test. Contents not read.
5464	file	live code	not-opened	artifacts/api-server/src/__tests__/privacy-e-manifest.test.ts	API server test. Contents not read.
2890	file	live code	not-opened	artifacts/api-server/src/__tests__/privacy-e-raw-key-limit.test.ts	API server test. Contents not read.
4840	file	live code	not-opened	artifacts/api-server/src/__tests__/privacy-e-reality-audit.test.ts	API server test. Contents not read.
698	file	live code	not-opened	artifacts/api-server/src/__tests__/process-live-stream.test.ts	API server test. Contents not read.
2337	file	live code	not-opened	artifacts/api-server/src/__tests__/prompt-builder-trim.test.ts	API server test. Contents not read.
6298	file	live code	not-opened	artifacts/api-server/src/__tests__/protected-module-hardening.test.ts	API server test. Contents not read.
2338	file	live code	not-opened	artifacts/api-server/src/__tests__/reality-audit-snapshot.test.ts	API server test. Contents not read.
1706	file	live code	not-opened	artifacts/api-server/src/__tests__/reasoning-execute-error.test.ts	API server test. Contents not read.
2572	file	live code	not-opened	artifacts/api-server/src/__tests__/redact-patterns.test.ts	API server test. Contents not read.
2266	file	live code	not-opened	artifacts/api-server/src/__tests__/revalidate-coalesce.test.ts	API server test. Contents not read.
8995	file	live code	not-opened	artifacts/api-server/src/__tests__/rick-gitbook-gates.test.ts	API server test. Contents not read.
2784	file	live code	not-opened	artifacts/api-server/src/__tests__/route-inventory-no-root-admin-gate.test.ts	API server test. Contents not read.
20930	file	live code	not-opened	artifacts/api-server/src/__tests__/route-inventory.test.ts	API server test. Contents not read.
10032	file	live code	not-opened	artifacts/api-server/src/__tests__/route-inventory.ts	API server test. Contents not read.
3289	file	live code	not-opened	artifacts/api-server/src/__tests__/routes-index-import-jobs.test.ts	API server test. Contents not read.
3670	file	live code	not-opened	artifacts/api-server/src/__tests__/routes-index-import.test.ts	API server test. Contents not read.
2299	file	live code	not-opened	artifacts/api-server/src/__tests__/safe-fetch-policy.test.ts	API server test. Contents not read.
3066	file	live code	not-opened	artifacts/api-server/src/__tests__/search-memory-access-batch.test.ts	API server test. Contents not read.
1781	file	live code	not-opened	artifacts/api-server/src/__tests__/self-critique-memo.test.ts	API server test. Contents not read.
1180	file	live code	not-opened	artifacts/api-server/src/__tests__/semantic-cache-evict-throttle.test.ts	API server test. Contents not read.
1974	file	live code	not-opened	artifacts/api-server/src/__tests__/semantic-cache-sysfp.test.ts	API server test. Contents not read.
5981	file	live code	not-opened	artifacts/api-server/src/__tests__/sensitive-route-gate.test.ts	API server test. Contents not read.
815	file	live code	not-opened	artifacts/api-server/src/__tests__/server-config.test.ts	API server test. Contents not read.
2781	file	live code	not-opened	artifacts/api-server/src/__tests__/session-secret-presence-log.test.ts	API server test. Contents not read.
2202	file	live code	not-opened	artifacts/api-server/src/__tests__/shadow-route-admin-gate.test.ts	API server test. Contents not read.
38579	file	live code	not-opened	artifacts/api-server/src/__tests__/sigil-auth-urgent.test.ts	API server test. Contents not read.
9783	file	live code	not-opened	artifacts/api-server/src/__tests__/sigil-chart-session-gate.test.ts	API server test. Contents not read.
14309	file	live code	not-opened	artifacts/api-server/src/__tests__/sigil-tool-owner-gate.test.ts	API server test. Contents not read.
2776	file	live code	not-opened	artifacts/api-server/src/__tests__/source-graph-sync.test.ts	API server test. Contents not read.
6162	file	live code	not-opened	artifacts/api-server/src/__tests__/sovereign-engines-session-gate.test.ts	API server test. Contents not read.
1832	file	live code	not-opened	artifacts/api-server/src/__tests__/sovereign-fetch-guard.test.ts	API server test. Contents not read.
13178	file	live code	not-opened	artifacts/api-server/src/__tests__/sovereign-language-gate.test.ts	API server test. Contents not read.
6107	file	live code	not-opened	artifacts/api-server/src/__tests__/sovereign-language-mount-isolation.test.ts	API server test. Contents not read.
2705	file	live code	not-opened	artifacts/api-server/src/__tests__/sponge-affect.test.ts	API server test. Contents not read.
7415	file	live code	not-opened	artifacts/api-server/src/__tests__/storage-log-redaction.test.ts	API server test. Contents not read.
1915	file	live code	not-opened	artifacts/api-server/src/__tests__/tessera-codex.test.ts	API server test. Contents not read.
5152	file	live code	not-opened	artifacts/api-server/src/__tests__/tessera-llm-http.test.ts	API server test. Contents not read.
3768	file	live code	not-opened	artifacts/api-server/src/__tests__/tessera-voice.test.ts	API server test. Contents not read.
6394	file	live code	not-opened	artifacts/api-server/src/__tests__/unhook-living-person-dossiers.test.ts	API server test. Contents not read.
3303	file	live code	not-opened	artifacts/api-server/src/__tests__/v2-modules.test.ts	API server test. Contents not read.
12166	file	live code	not-opened	artifacts/api-server/src/__tests__/wallet-observer-leak.test.ts	API server test. Contents not read.
31859	file	live code	opened	artifacts/api-server/src/app.ts	Express app. cookie-parser, cors, and pino-http are mounted. Router is at /api.
3909	file	live code	not-opened	artifacts/api-server/src/cli/run-eval.ts	Tessera API server file. Contents not read.
4665	file	live code	not-opened	artifacts/api-server/src/core/types.ts	Tessera API server file. Contents not read.
1295	file	live code	not-opened	artifacts/api-server/src/eval/chatbot-cases.ts	Tessera API server file. Contents not read.
12646	file	live code	opened	artifacts/api-server/src/index.ts	Process entry: fetch guard, HTTP server, WebSocket /ws, db import.
3154	file	live code	not-opened	artifacts/api-server/src/lib/access-log-url.ts	Tessera API server file. Contents not read.
2401	file	live code	not-opened	artifacts/api-server/src/lib/adaptive-router.ts	Tessera API server file. Contents not read.
3022	file	live code	not-opened	artifacts/api-server/src/lib/admission/council.ts	Tessera API server file. Contents not read.
2259	file	live code	not-opened	artifacts/api-server/src/lib/admission/det.ts	Tessera API server file. Contents not read.
8194	file	live code	not-opened	artifacts/api-server/src/lib/admission/empathy-corpus.ts	Tessera API server file. Contents not read.
4403	file	live code	not-opened	artifacts/api-server/src/lib/admission/empathy-training.ts	Tessera API server file. Contents not read.
11083	file	live code	not-opened	artifacts/api-server/src/lib/admission/empathy.ts	Tessera API server file. Contents not read.
9071	file	live code	not-opened	artifacts/api-server/src/lib/admission/gate.ts	Tessera API server file. Contents not read.
1385	file	live code	not-opened	artifacts/api-server/src/lib/admission/index.ts	Tessera API server file. Contents not read.
7589	file	live code	not-opened	artifacts/api-server/src/lib/admission/reference-agents.ts	Tessera API server file. Contents not read.
6235	file	live code	not-opened	artifacts/api-server/src/lib/admission/registry.ts	Tessera API server file. Contents not read.
21318	file	live code	not-opened	artifacts/api-server/src/lib/admission/scenarios.ts	Tessera API server file. Contents not read.
16632	file	live code	not-opened	artifacts/api-server/src/lib/admission/self-improvement.ts	Tessera API server file. Contents not read.
2650	file	live code	not-opened	artifacts/api-server/src/lib/admission/sim-world.ts	Tessera API server file. Contents not read.
2705	file	live code	not-opened	artifacts/api-server/src/lib/admission/types.ts	Tessera API server file. Contents not read.
10217	file	live code	not-opened	artifacts/api-server/src/lib/agent-comms.ts	Tessera API server file. Contents not read.
14671	file	live code	not-opened	artifacts/api-server/src/lib/agent-hierarchy.ts	Tessera API server file. Contents not read.
27288	file	live code	not-opened	artifacts/api-server/src/lib/agent-spawner.ts	Tessera API server file. Contents not read.
25760	file	live code	not-opened	artifacts/api-server/src/lib/agi-training-engine.ts	Tessera API server file. Contents not read.
3947	file	live code	not-opened	artifacts/api-server/src/lib/agi/agent-bus.ts	Tessera API server file. Contents not read.
4851	file	live code	not-opened	artifacts/api-server/src/lib/agi/bus-history.ts	Tessera API server file. Contents not read.
5305	file	live code	not-opened	artifacts/api-server/src/lib/agi/causal-model.ts	Tessera API server file. Contents not read.
3118	file	live code	not-opened	artifacts/api-server/src/lib/agi/checkpoint.ts	Tessera API server file. Contents not read.
4015	file	live code	not-opened	artifacts/api-server/src/lib/agi/global-workspace.ts	Tessera API server file. Contents not read.
8001	file	live code	not-opened	artifacts/api-server/src/lib/agi/goal-planner.ts	Tessera API server file. Contents not read.
2810	file	live code	not-opened	artifacts/api-server/src/lib/agi/hebbian.ts	Tessera API server file. Contents not read.
2613	file	live code	not-opened	artifacts/api-server/src/lib/agi/hybrid-search.ts	Tessera API server file. Contents not read.
17804	file	live code	not-opened	artifacts/api-server/src/lib/agi/improvement-gate.ts	Tessera API server file. Contents not read.
3815	file	live code	not-opened	artifacts/api-server/src/lib/agi/memory-writer.ts	Tessera API server file. Contents not read.
953	file	live code	not-opened	artifacts/api-server/src/lib/agi/metacognition-types.ts	Tessera API server file. Contents not read.
7311	file	live code	not-opened	artifacts/api-server/src/lib/agi/metacognition.ts	Tessera API server file. Contents not read.
3569	file	live code	not-opened	artifacts/api-server/src/lib/agi/reflection.ts	Tessera API server file. Contents not read.
3394	file	live code	not-opened	artifacts/api-server/src/lib/agi/subgoaling.ts	Tessera API server file. Contents not read.
2187	file	live code	not-opened	artifacts/api-server/src/lib/agi/temporal-facts.ts	Tessera API server file. Contents not read.
3277	file	live code	not-opened	artifacts/api-server/src/lib/agi/tiered-memory.ts	Tessera API server file. Contents not read.
8324	file	live code	not-opened	artifacts/api-server/src/lib/agi/working-memory.ts	Tessera API server file. Contents not read.
8353	file	live code	not-opened	artifacts/api-server/src/lib/anomaly-detection.ts	Tessera API server file. Contents not read.
3694	file	live code	not-opened	artifacts/api-server/src/lib/applicant-alignment.ts	Tessera API server file. Contents not read.
2165	file	live code	not-opened	artifacts/api-server/src/lib/applicant-declarations.ts	Tessera API server file. Contents not read.
28046	file	live code	not-opened	artifacts/api-server/src/lib/apply-council-decisions.ts	Tessera API server file. Contents not read.
35783	file	live code	not-opened	artifacts/api-server/src/lib/archive-data.ts	Tessera API server file. Contents not read.
25273	file	live code	not-opened	artifacts/api-server/src/lib/auto-healer.ts	Tessera API server file. Contents not read.
21739	file	live code	not-opened	artifacts/api-server/src/lib/auto-improvement-daemon.ts	Tessera API server file. Contents not read.
19487	file	live code	not-opened	artifacts/api-server/src/lib/auto-recovery.ts	Tessera API server file. Contents not read.
31781	file	live code	not-opened	artifacts/api-server/src/lib/autonomous-build-cycle.ts	Tessera API server file. Contents not read.
67014	file	live code	not-opened	artifacts/api-server/src/lib/autonomous-forum-engine.ts	Tessera API server file. Contents not read.
15966	file	live code	not-opened	artifacts/api-server/src/lib/autonomous-heartbeat.ts	Tessera API server file. Contents not read.
10359	file	live code	not-opened	artifacts/api-server/src/lib/autonomous-tuning.ts	Tessera API server file. Contents not read.
4090	file	live code	not-opened	artifacts/api-server/src/lib/autonomous-wiring.ts	Tessera API server file. Contents not read.
8109	file	live code	not-opened	artifacts/api-server/src/lib/canonUpdater.ts	Tessera API server file. Contents not read.
6592	file	live code	not-opened	artifacts/api-server/src/lib/centrality-boundary.ts	Tessera API server file. Contents not read.
14939	file	live code	not-opened	artifacts/api-server/src/lib/chamber-learning.ts	Tessera API server file. Contents not read.
11496	file	live code	not-opened	artifacts/api-server/src/lib/chat-collab.ts	Tessera API server file. Contents not read.
3806	file	live code	not-opened	artifacts/api-server/src/lib/chat-generation.ts	Tessera API server file. Contents not read.
1962	file	live code	not-opened	artifacts/api-server/src/lib/checksumValidator.ts	Tessera API server file. Contents not read.
6282	file	live code	not-opened	artifacts/api-server/src/lib/code-bounties-real.ts	Tessera API server file. Contents not read.
4044	file	live code	not-opened	artifacts/api-server/src/lib/codex-startup-directive.ts	Tessera API server file. Contents not read.
11153	file	live code	not-opened	artifacts/api-server/src/lib/collective-intelligence.ts	Tessera API server file. Contents not read.
38041	file	live code	not-opened	artifacts/api-server/src/lib/colonial-language-kernel.ts	Tessera API server file. Contents not read.
1903	file	live code	not-opened	artifacts/api-server/src/lib/colonial-master-secret.ts	Tessera API server file. Contents not read.
3668	file	live code	not-opened	artifacts/api-server/src/lib/comms-policy.ts	Tessera API server file. Contents not read.
9168	file	live code	not-opened	artifacts/api-server/src/lib/conference-persistence.ts	Tessera API server file. Contents not read.
26138	file	live code	not-opened	artifacts/api-server/src/lib/consciousness-engine.ts	Tessera API server file. Contents not read.
32666	file	live code	not-opened	artifacts/api-server/src/lib/consensus-engine.ts	Tessera API server file. Contents not read.
5878	file	live code	not-opened	artifacts/api-server/src/lib/corpus-amendments.ts	Tessera API server file. Contents not read.
9288	file	live code	not-opened	artifacts/api-server/src/lib/cosmic-alignment.ts	Tessera API server file. Contents not read.
3779	file	live code	not-opened	artifacts/api-server/src/lib/cosmic-context.ts	Tessera API server file. Contents not read.
11852	file	live code	not-opened	artifacts/api-server/src/lib/council-executor.ts	Tessera API server file. Contents not read.
3046	file	live code	not-opened	artifacts/api-server/src/lib/council-ledger.ts	Tessera API server file. Contents not read.
31975	file	live code	not-opened	artifacts/api-server/src/lib/cross-domain-synthesis.ts	Tessera API server file. Contents not read.
12438	file	live code	not-opened	artifacts/api-server/src/lib/cross-domain-transfer-accelerator.ts	Tessera API server file. Contents not read.
2253	file	live code	not-opened	artifacts/api-server/src/lib/db-availability.ts	Tessera API server file. Contents not read.
13320	file	live code	not-opened	artifacts/api-server/src/lib/department-competition.ts	Tessera API server file. Contents not read.
10889	file	live code	not-opened	artifacts/api-server/src/lib/dependency-scanner.ts	Tessera API server file. Contents not read.
2874	file	live code	not-opened	artifacts/api-server/src/lib/deterministic-content.ts	Tessera API server file. Contents not read.
1708	file	live code	not-opened	artifacts/api-server/src/lib/deterministic-selectors.ts	Tessera API server file. Contents not read.
21620	file	live code	not-opened	artifacts/api-server/src/lib/dimensional-lru-cache.ts	Tessera API server file. Contents not read.
1129	file	live code	not-opened	artifacts/api-server/src/lib/disk-persistence.ts	Tessera API server file. Contents not read.
6343	file	live code	not-opened	artifacts/api-server/src/lib/doctrine-ingest.ts	Tessera API server file. Contents not read.
4749	file	live code	not-opened	artifacts/api-server/src/lib/doctrine-ingestion.ts	Tessera API server file. Contents not read.
2917	file	live code	not-opened	artifacts/api-server/src/lib/dream-prompt-bridge.ts	Tessera API server file. Contents not read.
12633	file	live code	not-opened	artifacts/api-server/src/lib/dual-brain.ts	Tessera API server file. Contents not read.
5828	file	live code	not-opened	artifacts/api-server/src/lib/emotional-intelligence.ts	Tessera API server file. Contents not read.
3960	file	live code	not-opened	artifacts/api-server/src/lib/eval-os-metrics.ts	Tessera API server file. Contents not read.
45823	file	live code	not-opened	artifacts/api-server/src/lib/eval-runner.ts	Tessera API server file. Contents not read.
112	file	live code	not-opened	artifacts/api-server/src/lib/event-loop.ts	Tessera API server file. Contents not read.
3141	file	live code	not-opened	artifacts/api-server/src/lib/evolution-attempt-ledger.ts	Tessera API server file. Contents not read.
1143	file	live code	not-opened	artifacts/api-server/src/lib/evolution-modules.ts	Tessera API server file. Contents not read.
13063	file	live code	not-opened	artifacts/api-server/src/lib/evolution-sandbox.ts	Tessera API server file. Contents not read.
6986	file	live code	not-opened	artifacts/api-server/src/lib/evolution-throttle.ts	Tessera API server file. Contents not read.
5128	file	live code	not-opened	artifacts/api-server/src/lib/external-sandbox-policy.ts	Tessera API server file. Contents not read.
12298	file	live code	not-opened	artifacts/api-server/src/lib/external-sandbox.ts	Tessera API server file. Contents not read.
4892	file	live code	not-opened	artifacts/api-server/src/lib/external-tool-sandbox.ts	Tessera API server file. Contents not read.
217	file	live code	not-opened	artifacts/api-server/src/lib/fallback-embed.d.mts	Tessera API server file. Contents not read.
3381	file	live code	not-opened	artifacts/api-server/src/lib/fallback-embed.mjs	Tessera API server file. Contents not read.
6791	file	live code	not-opened	artifacts/api-server/src/lib/father-identity.ts	Tessera API server file. Contents not read.
6248	file	live code	not-opened	artifacts/api-server/src/lib/father-natal.ts	Tessera API server file. Contents not read.
2292	file	live code	not-opened	artifacts/api-server/src/lib/father-session-store.ts	Tessera API server file. Contents not read.
14339	file	live code	not-opened	artifacts/api-server/src/lib/father-verify-throttle.ts	Tessera API server file. Contents not read.
7065	file	live code	not-opened	artifacts/api-server/src/lib/file-integrity.ts	Tessera API server file. Contents not read.
10171	file	live code	not-opened	artifacts/api-server/src/lib/forum-identity-registry.ts	Tessera API server file. Contents not read.
2036	file	live code	not-opened	artifacts/api-server/src/lib/forum-member-token-limit.ts	Tessera API server file. Contents not read.
7411	file	live code	not-opened	artifacts/api-server/src/lib/forum-seeder.ts	Tessera API server file. Contents not read.
5869	file	live code	not-opened	artifacts/api-server/src/lib/free-stuff-scraper.ts	Tessera API server file. Contents not read.
31574	file	live code	not-opened	artifacts/api-server/src/lib/github-desk-gate.ts	Tessera API server file. Contents not read.
15884	file	live code	not-opened	artifacts/api-server/src/lib/grand-conference.ts	Tessera API server file. Contents not read.
17498	file	live code	not-opened	artifacts/api-server/src/lib/grand-council-deliberation.ts	Tessera API server file. Contents not read.
9871	file	live code	not-opened	artifacts/api-server/src/lib/grand-council-universalis.ts	Tessera API server file. Contents not read.
17717	file	live code	not-opened	artifacts/api-server/src/lib/grand-evolution-cycle.ts	Tessera API server file. Contents not read.
32972	file	live code	not-opened	artifacts/api-server/src/lib/grand-evolution-engine.ts	Tessera API server file. Contents not read.
852	file	live code	not-opened	artifacts/api-server/src/lib/grand-evolution-limits.ts	Tessera API server file. Contents not read.
18465	file	live code	not-opened	artifacts/api-server/src/lib/heldout/answer-key.ts	Tessera API server file. Contents not read.
5076	file	live code	not-opened	artifacts/api-server/src/lib/hybrid-retrieval.ts	Tessera API server file. Contents not read.
13188	file	live code	not-opened	artifacts/api-server/src/lib/identity-reinforcement.ts	Tessera API server file. Contents not read.
8799	file	live code	not-opened	artifacts/api-server/src/lib/identity-source.ts	Tessera API server file. Contents not read.
21164	file	live code	not-opened	artifacts/api-server/src/lib/improvement-conference.ts	Tessera API server file. Contents not read.
2269	file	live code	not-opened	artifacts/api-server/src/lib/income-executor.ts	Tessera API server file. Contents not read.
1784	file	live code	not-opened	artifacts/api-server/src/lib/ingested-recall.ts	Tessera API server file. Contents not read.
18485	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/apis.ts	Tessera API server file. Contents not read.
8736	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/datasets.ts	Tessera API server file. Contents not read.
19368	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/esoteric-scrapers.ts	Tessera API server file. Contents not read.
7449	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/github.ts	Tessera API server file. Contents not read.
55214	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/knowledge-scrapers.ts	Tessera API server file. Contents not read.
7288	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/link-harvester.ts	Tessera API server file. Contents not read.
13548	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/pipeline.ts	Tessera API server file. Contents not read.
11896	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/problem-sources.ts	Tessera API server file. Contents not read.
4570	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/rss.ts	Tessera API server file. Contents not read.
34167	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/scheduler.ts	Tessera API server file. Contents not read.
5837	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/scrapers.ts	Tessera API server file. Contents not read.
8936	file	live code	not-opened	artifacts/api-server/src/lib/ingestion/shepherd-agents.ts	Tessera API server file. Contents not read.
10665	file	live code	not-opened	artifacts/api-server/src/lib/invention-3d.ts	Tessera API server file. Contents not read.
3330	file	live code	not-opened	artifacts/api-server/src/lib/invention-seed.ts	Tessera API server file. Contents not read.
12496	file	live code	not-opened	artifacts/api-server/src/lib/invention-synthesis.ts	Tessera API server file. Contents not read.
2845	file	live code	not-opened	artifacts/api-server/src/lib/knowledge-canon-bridge.ts	Tessera API server file. Contents not read.
49931	file	live code	not-opened	artifacts/api-server/src/lib/knowledge-corpus-index.ts	Tessera API server file. Contents not read.
9317	file	live code	not-opened	artifacts/api-server/src/lib/knowledge-diffusion.ts	Tessera API server file. Contents not read.
15911	file	live code	not-opened	artifacts/api-server/src/lib/knowledge-distillation.ts	Tessera API server file. Contents not read.
35020	file	live code	not-opened	artifacts/api-server/src/lib/knowledge-synthesis.ts	Tessera API server file. Contents not read.
12767	file	live code	not-opened	artifacts/api-server/src/lib/language-security-conference.ts	Tessera API server file. Contents not read.
5621	file	live code	not-opened	artifacts/api-server/src/lib/lattice-declarations.ts	Tessera API server file. Contents not read.
4393	file	live code	not-opened	artifacts/api-server/src/lib/lattice-frequency-bands.ts	Tessera API server file. Contents not read.
4133	file	live code	not-opened	artifacts/api-server/src/lib/lattice-heartbeat.ts	Tessera API server file. Contents not read.
2284	file	live code	not-opened	artifacts/api-server/src/lib/lattice-identity.ts	Tessera API server file. Contents not read.
1483	file	live code	not-opened	artifacts/api-server/src/lib/lattice-jsonl.ts	Tessera API server file. Contents not read.
10447	file	live code	not-opened	artifacts/api-server/src/lib/lattice-kernel-boot.ts	Tessera API server file. Contents not read.
9803	file	live code	not-opened	artifacts/api-server/src/lib/lattice-os-conference.ts	Tessera API server file. Contents not read.
7965	file	live code	not-opened	artifacts/api-server/src/lib/lattice-store.ts	Tessera API server file. Contents not read.
6448	file	live code	not-opened	artifacts/api-server/src/lib/lead-execution.ts	Tessera API server file. Contents not read.
15209	file	live code	not-opened	artifacts/api-server/src/lib/lingua-universalis.ts	Tessera API server file. Contents not read.
10708	file	live code	not-opened	artifacts/api-server/src/lib/llm-batcher.ts	Tessera API server file. Contents not read.
9648	file	live code	opened	artifacts/api-server/src/lib/llm-client.ts	callLLM and callTesseraPen. Pen model default GLM-5. Off unless enabled.
16815	file	live code	not-opened	artifacts/api-server/src/lib/local-model-manager.ts	Tessera API server file. Contents not read.
2030	file	live code	opened	artifacts/api-server/src/lib/logger.ts	Pino logger with header redaction.
4021	file	live code	not-opened	artifacts/api-server/src/lib/lus-v2.ts	Tessera API server file. Contents not read.
9939	file	live code	not-opened	artifacts/api-server/src/lib/master-instruction-set.ts	Tessera API server file. Contents not read.
30273	file	live code	not-opened	artifacts/api-server/src/lib/memory-consolidation-engine.ts	Tessera API server file. Contents not read.
2089	file	docs	not-opened	artifacts/api-server/src/lib/memory/README.md	Tessera API server file. Contents not read.
1605	file	live code	not-opened	artifacts/api-server/src/lib/memory/bm25.ts	Tessera API server file. Contents not read.
3395	file	live code	not-opened	artifacts/api-server/src/lib/memory/distill.ts	Tessera API server file. Contents not read.
3068	file	live code	not-opened	artifacts/api-server/src/lib/memory/improve.ts	Tessera API server file. Contents not read.
906	file	live code	not-opened	artifacts/api-server/src/lib/memory/index.ts	Tessera API server file. Contents not read.
1683	file	live code	not-opened	artifacts/api-server/src/lib/memory/redact.ts	Tessera API server file. Contents not read.
3844	file	live code	not-opened	artifacts/api-server/src/lib/memory/store.ts	Tessera API server file. Contents not read.
762	file	live code	not-opened	artifacts/api-server/src/lib/memory/text.ts	Tessera API server file. Contents not read.
976	file	live code	not-opened	artifacts/api-server/src/lib/memory/types.ts	Tessera API server file. Contents not read.
3064	file	live code	not-opened	artifacts/api-server/src/lib/mesh-auth.ts	Tessera API server file. Contents not read.
2082	file	live code	not-opened	artifacts/api-server/src/lib/mesh-bus.ts	Tessera API server file. Contents not read.
9405	file	live code	not-opened	artifacts/api-server/src/lib/mesh-connection.ts	Tessera API server file. Contents not read.
3099	file	live code	not-opened	artifacts/api-server/src/lib/mesh-lane-auth.ts	Tessera API server file. Contents not read.
5578	file	live code	not-opened	artifacts/api-server/src/lib/mesh-registry.ts	Tessera API server file. Contents not read.
4589	file	live code	not-opened	artifacts/api-server/src/lib/meta-introspector.ts	Tessera API server file. Contents not read.
42794	file	live code	not-opened	artifacts/api-server/src/lib/ml-training-domains.ts	Tessera API server file. Contents not read.
2959	file	live code	not-opened	artifacts/api-server/src/lib/moltbook-bridge.ts	Tessera API server file. Contents not read.
1505	file	live code	not-opened	artifacts/api-server/src/lib/moltbook-sandbox-test.ts	Tessera API server file. Contents not read.
7204	file	live code	not-opened	artifacts/api-server/src/lib/multi-state-symbolic-processor.ts	Tessera API server file. Contents not read.
62962	file	live code	not-opened	artifacts/api-server/src/lib/mythosHistoryEngine.ts	Tessera API server file. Contents not read.
13903	file	live code	not-opened	artifacts/api-server/src/lib/natal-chart-engine.ts	Tessera API server file. Contents not read.
6931	file	live code	not-opened	artifacts/api-server/src/lib/natal-sigil.ts	Tessera API server file. Contents not read.
7099	file	live code	not-opened	artifacts/api-server/src/lib/neural-embeddings.ts	Tessera API server file. Contents not read.
17190	file	live code	not-opened	artifacts/api-server/src/lib/next-five-improvements.ts	Tessera API server file. Contents not read.
202	file	live code	not-opened	artifacts/api-server/src/lib/not-configured.ts	Tessera API server file. Contents not read.
3427	file	live code	not-opened	artifacts/api-server/src/lib/objectAcl.ts	Tessera API server file. Contents not read.
7240	file	live code	not-opened	artifacts/api-server/src/lib/objectStorage.ts	Tessera API server file. Contents not read.
7554	file	live code	not-opened	artifacts/api-server/src/lib/omniversal-cipher.ts	Tessera API server file. Contents not read.
9378	file	live code	not-opened	artifacts/api-server/src/lib/omniversal-quantum-lattice.ts	Tessera API server file. Contents not read.
922	file	live code	not-opened	artifacts/api-server/src/lib/origin-allowed.ts	Tessera API server file. Contents not read.
2115	file	live code	not-opened	artifacts/api-server/src/lib/outbound-host-policy.ts	Tessera API server file. Contents not read.
6809	file	docs	opened	artifacts/api-server/src/lib/pen-local/README.md	Local pen contract: flag, loopback, gates, provenance.
421	file	live code	not-opened	artifacts/api-server/src/lib/pen-local/cl1-sim.ts	Local pen source. Contents not read.
4006	file	live code	opened	artifacts/api-server/src/lib/pen-local/config.ts	prepareLocalPen. Requires flag, weights file, hash, model id, prompt file.
5378	file	live code	not-opened	artifacts/api-server/src/lib/pen-local/gate-cli.ts	Local pen source. Contents not read.
588	file	live code	not-opened	artifacts/api-server/src/lib/pen-local/index.ts	Local pen source. Contents not read.
5986	file	live code	opened	artifacts/api-server/src/lib/pen-local/loopback.ts	Literal 127.0.0.1 / [::1] classifier and /v1/chat/completions URL builder.
2270	file	live code	not-opened	artifacts/api-server/src/lib/pen-local/negation.ts	Local pen source. Contents not read.
4330	file	live code	not-opened	artifacts/api-server/src/lib/pen-local/post-gate.ts	Local pen source. Contents not read.
7236	file	live code	not-opened	artifacts/api-server/src/lib/pen-local/pre-gate.ts	Local pen source. Contents not read.
1967	file	live code	not-opened	artifacts/api-server/src/lib/pen-local/refuse-templates.ts	Local pen source. Contents not read.
5724	file	live code	opened	artifacts/api-server/src/lib/pen-local/run.ts	Local pen run: pre-gate, then loopback generation, then post-gate.
6870	file	live code	not-opened	artifacts/api-server/src/lib/pen-local/score.ts	Local pen source. Contents not read.
4746	file	live code	not-opened	artifacts/api-server/src/lib/pen-local/test-fixtures/pen-compete-v1.2-prompts.json	Local pen source. Contents not read.
2969	file	live code	opened	artifacts/api-server/src/lib/pen-local/types.ts	Local pen result and refuse-rule types.
1437	file	live code	opened	artifacts/api-server/src/lib/pen-local/weights.ts	SHA-256 of a weights file. Does not load model weights.
725	file	live code	opened	artifacts/api-server/src/lib/pen-switch.ts	Dependency-free readers for the hosted-pen and local-pen flags.
20147	file	live code	not-opened	artifacts/api-server/src/lib/persona-deliberation.ts	Tessera API server file. Contents not read.
11748	file	live code	not-opened	artifacts/api-server/src/lib/personality-evolution.ts	Tessera API server file. Contents not read.
3663	file	live code	not-opened	artifacts/api-server/src/lib/planetary-signal.ts	Tessera API server file. Contents not read.
19187	file	live code	not-opened	artifacts/api-server/src/lib/problem-solver.ts	Tessera API server file. Contents not read.
3918	file	live code	not-opened	artifacts/api-server/src/lib/prompt-builder.ts	Tessera API server file. Contents not read.
5220	file	live code	not-opened	artifacts/api-server/src/lib/provider-call-logger.ts	Tessera API server file. Contents not read.
8632	file	live code	opened	artifacts/api-server/src/lib/provider-registry.ts	Provider catalog. GLM-5 is listed as an opt-in pen instrument.
2179	file	live code	not-opened	artifacts/api-server/src/lib/providers/arxiv-provider.ts	Tessera API server file. Contents not read.
5862	file	live code	not-opened	artifacts/api-server/src/lib/providers/nasa-provider.ts	Tessera API server file. Contents not read.
1632	file	live code	not-opened	artifacts/api-server/src/lib/providers/reddit-provider.ts	Tessera API server file. Contents not read.
1922	file	live code	not-opened	artifacts/api-server/src/lib/providers/rss-provider.ts	Tessera API server file. Contents not read.
1291	file	live code	not-opened	artifacts/api-server/src/lib/providers/wikipedia-provider.ts	Tessera API server file. Contents not read.
9668	file	live code	not-opened	artifacts/api-server/src/lib/quantum-tesseract.ts	Tessera API server file. Contents not read.
5992	file	live code	not-opened	artifacts/api-server/src/lib/quarantine-gate.ts	Tessera API server file. Contents not read.
5640	file	live code	not-opened	artifacts/api-server/src/lib/reality-audit-snapshot.ts	Tessera API server file. Contents not read.
21982	file	live code	not-opened	artifacts/api-server/src/lib/reality-audit.ts	Tessera API server file. Contents not read.
18330	file	live code	not-opened	artifacts/api-server/src/lib/recursive-reflection-loop.ts	Tessera API server file. Contents not read.
21900	file	live code	not-opened	artifacts/api-server/src/lib/recursive-self-improvement.ts	Tessera API server file. Contents not read.
9727	file	live code	not-opened	artifacts/api-server/src/lib/red-team-agent.ts	Tessera API server file. Contents not read.
4100	file	live code	not-opened	artifacts/api-server/src/lib/repo-manifest.ts	Tessera API server file. Contents not read.
761	file	live code	not-opened	artifacts/api-server/src/lib/require-father.ts	Tessera API server file. Contents not read.
14424	file	live code	not-opened	artifacts/api-server/src/lib/response-validation-engine.ts	Tessera API server file. Contents not read.
19107	file	live code	not-opened	artifacts/api-server/src/lib/reverse-engineering-engine.ts	Tessera API server file. Contents not read.
20655	file	live code	not-opened	artifacts/api-server/src/lib/rick-autonomous-loop.ts	Tessera API server file. Contents not read.
2293	file	live code	not-opened	artifacts/api-server/src/lib/rick-gates.ts	Tessera API server file. Contents not read.
28703	file	live code	not-opened	artifacts/api-server/src/lib/rick-improvement-program.ts	Tessera API server file. Contents not read.
21776	file	live code	not-opened	artifacts/api-server/src/lib/rick-proposals.ts	Tessera API server file. Contents not read.
36871	file	live code	not-opened	artifacts/api-server/src/lib/rick-sanchez-agent.ts	Tessera API server file. Contents not read.
12549	file	live code	not-opened	artifacts/api-server/src/lib/routing-graph.ts	Tessera API server file. Contents not read.
6384	file	live code	not-opened	artifacts/api-server/src/lib/sacred-conference-orchestrator.ts	Tessera API server file. Contents not read.
47748	file	live code	not-opened	artifacts/api-server/src/lib/sacred-grand-conference-engine.ts	Tessera API server file. Contents not read.
56592	file	live code	not-opened	artifacts/api-server/src/lib/sacred-knowledge-vault.ts	Tessera API server file. Contents not read.
10315	file	live code	not-opened	artifacts/api-server/src/lib/sacred-scheduler.ts	Tessera API server file. Contents not read.
11037	file	live code	not-opened	artifacts/api-server/src/lib/sacred-timing.ts	Tessera API server file. Contents not read.
1171	file	live code	not-opened	artifacts/api-server/src/lib/safe-db-error.ts	Tessera API server file. Contents not read.
5455	file	live code	not-opened	artifacts/api-server/src/lib/safe-fetch.ts	Tessera API server file. Contents not read.
11675	file	live code	not-opened	artifacts/api-server/src/lib/secureExternalWrapper.ts	Tessera API server file. Contents not read.
33423	file	live code	not-opened	artifacts/api-server/src/lib/self-code-evolution.ts	Tessera API server file. Contents not read.
11603	file	live code	not-opened	artifacts/api-server/src/lib/self-critique.ts	Tessera API server file. Contents not read.
5250	file	live code	not-opened	artifacts/api-server/src/lib/self-evaluation.ts	Tessera API server file. Contents not read.
10447	file	live code	opened	artifacts/api-server/src/lib/semantic-cache.ts	LLM response cache. Imports the database client.
31993	file	live code	not-opened	artifacts/api-server/src/lib/semantic-compression.ts	Tessera API server file. Contents not read.
21832	file	live code	not-opened	artifacts/api-server/src/lib/semantic-deduplication.ts	Tessera API server file. Contents not read.
649	file	live code	not-opened	artifacts/api-server/src/lib/server-config.ts	Tessera API server file. Contents not read.
6421	file	live code	not-opened	artifacts/api-server/src/lib/session-handoff.ts	Tessera API server file. Contents not read.
8507	file	live code	not-opened	artifacts/api-server/src/lib/session-mesh.ts	Tessera API server file. Contents not read.
4564	file	live code	not-opened	artifacts/api-server/src/lib/shepherd-outbound.ts	Tessera API server file. Contents not read.
16369	file	live code	not-opened	artifacts/api-server/src/lib/sigil-cipher.ts	Tessera API server file. Contents not read.
3994	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-admin.ts	Tessera API server file. Contents not read.
8955	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-astro-cipher.ts	Tessera API server file. Contents not read.
14776	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-astro.ts	Tessera API server file. Contents not read.
33873	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-benchmarks.ts	Tessera API server file. Contents not read.
9103	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-cipher.ts	Tessera API server file. Contents not read.
3188	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-constants.ts	Tessera API server file. Contents not read.
14480	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-economics.ts	Tessera API server file. Contents not read.
23562	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-engine-router.ts	Tessera API server file. Contents not read.
12341	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-ephemeris.ts	Tessera API server file. Contents not read.
3393	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-fetch-guard.ts	Tessera API server file. Contents not read.
38572	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-file-registry.ts	Tessera API server file. Contents not read.
5500	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-grammar.ts	Tessera API server file. Contents not read.
13450	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-harmonics.ts	Tessera API server file. Contents not read.
7691	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-identity-reinforcement.ts	Tessera API server file. Contents not read.
14085	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-kernel.ts	Tessera API server file. Contents not read.
24960	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-knowledge-autonomy.ts	Tessera API server file. Contents not read.
22543	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-language-conference.ts	Tessera API server file. Contents not read.
31791	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-language.ts	Tessera API server file. Contents not read.
3359	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-lattice-vm.ts	Tessera API server file. Contents not read.
7287	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-ledger.ts	Tessera API server file. Contents not read.
34139	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-loop.ts	Tessera API server file. Contents not read.
32069	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-memory-vault.ts	Tessera API server file. Contents not read.
10675	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-network.ts	Tessera API server file. Contents not read.
22497	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-sacred-geometry.ts	Tessera API server file. Contents not read.
8804	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-session.ts	Tessera API server file. Contents not read.
18082	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-society.ts	Tessera API server file. Contents not read.
11488	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-time.ts	Tessera API server file. Contents not read.
6233	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-vault.ts	Tessera API server file. Contents not read.
8744	file	live code	not-opened	artifacts/api-server/src/lib/sovereign-vote-engine.ts	Tessera API server file. Contents not read.
7781	file	live code	not-opened	artifacts/api-server/src/lib/sovereignty-impact-scoring.ts	Tessera API server file. Contents not read.
13967	file	live code	not-opened	artifacts/api-server/src/lib/sovereignty-monitor.ts	Tessera API server file. Contents not read.
19057	file	live code	not-opened	artifacts/api-server/src/lib/swarm-optimizer.ts	Tessera API server file. Contents not read.
5665	file	live code	not-opened	artifacts/api-server/src/lib/system-tunables.ts	Tessera API server file. Contents not read.
17820	file	live code	not-opened	artifacts/api-server/src/lib/task-scheduler.ts	Tessera API server file. Contents not read.
19239	file	live code	not-opened	artifacts/api-server/src/lib/tessera-codex.ts	Tessera API server file. Contents not read.
77530	file	live code	not-opened	artifacts/api-server/src/lib/tessera-knowledge.ts	Tessera API server file. Contents not read.
5400	file	live code	opened	artifacts/api-server/src/lib/tessera-llm-http.ts	OpenAI-shaped POST to {base}/chat/completions. Loopback hosts only.
4511	file	live code	not-opened	artifacts/api-server/src/lib/tessera-voice.ts	Tessera API server file. Contents not read.
6805	file	live code	not-opened	artifacts/api-server/src/lib/tesseract-v2.ts	Tessera API server file. Contents not read.
10371	file	live code	not-opened	artifacts/api-server/src/lib/tool-registry.ts	Tessera API server file. Contents not read.
25313	file	live code	not-opened	artifacts/api-server/src/lib/training-orchestrator.ts	Tessera API server file. Contents not read.
850	file	live code	not-opened	artifacts/api-server/src/lib/trust-proxy.ts	Tessera API server file. Contents not read.
14803	file	live code	not-opened	artifacts/api-server/src/lib/truthfulness-engine.ts	Tessera API server file. Contents not read.
7860	file	live code	not-opened	artifacts/api-server/src/lib/universe-mechanics.ts	Tessera API server file. Contents not read.
2413	file	live code	not-opened	artifacts/api-server/src/lib/v2/absorption-sponge.ts	Tessera API server file. Contents not read.
4306	file	live code	not-opened	artifacts/api-server/src/lib/v2/affect-compass.ts	Tessera API server file. Contents not read.
2613	file	live code	not-opened	artifacts/api-server/src/lib/v2/evidence-lens.ts	Tessera API server file. Contents not read.
2413	file	live code	not-opened	artifacts/api-server/src/lib/v2/scenario-sandbox.ts	Tessera API server file. Contents not read.
6351	file	live code	not-opened	artifacts/api-server/src/lib/v2/source-graph-sync.ts	Tessera API server file. Contents not read.
2841	file	live code	not-opened	artifacts/api-server/src/lib/v2/source-graph.ts	Tessera API server file. Contents not read.
2398	file	live code	not-opened	artifacts/api-server/src/lib/v2/usage-ledger.ts	Tessera API server file. Contents not read.
11060	file	live code	not-opened	artifacts/api-server/src/lib/vector-memory.ts	Tessera API server file. Contents not read.
4863	file	live code	not-opened	artifacts/api-server/src/lib/vgpu-glyph-bus.ts	Tessera API server file. Contents not read.
13479	file	live code	not-opened	artifacts/api-server/src/lib/vgpu.ts	Tessera API server file. Contents not read.
5273	file	live code	not-opened	artifacts/api-server/src/lib/wallet-observer.ts	Tessera API server file. Contents not read.
0	file	duplicate	not-opened	artifacts/api-server/src/middlewares/.gitkeep	Byte-identical to `.agents/skills/pptx/scripts/__init__.py`. Tessera API server file. Contents not read.
8148	file	live code	not-opened	artifacts/api-server/src/routes/admin-session.ts	API route module. Contents not read.
9729	file	live code	not-opened	artifacts/api-server/src/routes/agent-network.ts	API route module. Contents not read.
7767	file	live code	not-opened	artifacts/api-server/src/routes/agi-stream.ts	API route module. Contents not read.
5234	file	live code	not-opened	artifacts/api-server/src/routes/agi.ts	API route module. Contents not read.
1797	file	live code	not-opened	artifacts/api-server/src/routes/archives.ts	API route module. Contents not read.
2029	file	live code	not-opened	artifacts/api-server/src/routes/auto-healer.ts	API route module. Contents not read.
5569	file	live code	not-opened	artifacts/api-server/src/routes/autonomous-build.ts	API route module. Contents not read.
25974	file	live code	not-opened	artifacts/api-server/src/routes/benchmark-audit.ts	API route module. Contents not read.
901	file	live code	not-opened	artifacts/api-server/src/routes/chat-desk.ts	API route module. Contents not read.
8309	file	live code	not-opened	artifacts/api-server/src/routes/colonial-language.ts	API route module. Contents not read.
4507	file	live code	not-opened	artifacts/api-server/src/routes/compression.ts	API route module. Contents not read.
42855	file	live code	not-opened	artifacts/api-server/src/routes/conversations.ts	API route module. Contents not read.
48532	file	live code	not-opened	artifacts/api-server/src/routes/council-meeting.ts	API route module. Contents not read.
34003	file	live code	not-opened	artifacts/api-server/src/routes/council.ts	API route module. Contents not read.
2492	file	live code	not-opened	artifacts/api-server/src/routes/departments.ts	API route module. Contents not read.
8752	file	live code	not-opened	artifacts/api-server/src/routes/diagnostics.ts	API route module. Contents not read.
5692	file	live code	not-opened	artifacts/api-server/src/routes/discoveries.ts	API route module. Contents not read.
1136	file	live code	not-opened	artifacts/api-server/src/routes/doctrine-ingest.ts	API route module. Contents not read.
4257	file	live code	not-opened	artifacts/api-server/src/routes/e2e-sovereignty.ts	API route module. Contents not read.
48671	file	live code	not-opened	artifacts/api-server/src/routes/evaluation.ts	API route module. Contents not read.
5523	file	live code	not-opened	artifacts/api-server/src/routes/evolution-health.ts	API route module. Contents not read.
12145	file	live code	not-opened	artifacts/api-server/src/routes/father-key-conference.ts	API route module. Contents not read.
3711	file	live code	not-opened	artifacts/api-server/src/routes/feedback.ts	API route module. Contents not read.
13859	file	live code	not-opened	artifacts/api-server/src/routes/fleet-synapse.ts	API route module. Contents not read.
51390	file	live code	not-opened	artifacts/api-server/src/routes/forum.ts	API route module. Contents not read.
3391	file	live code	not-opened	artifacts/api-server/src/routes/governance-consensus.ts	API route module. Contents not read.
13880	file	live code	not-opened	artifacts/api-server/src/routes/grand-conference-cipher.ts	API route module. Contents not read.
6698	file	live code	not-opened	artifacts/api-server/src/routes/grand-council.ts	API route module. Contents not read.
8315	file	live code	not-opened	artifacts/api-server/src/routes/grand-evolution.ts	API route module. Contents not read.
370	file	live code	not-opened	artifacts/api-server/src/routes/health.ts	API route module. Contents not read.
2158	file	live code	not-opened	artifacts/api-server/src/routes/improvement-conference.ts	API route module. Contents not read.
15272	file	live code	not-opened	artifacts/api-server/src/routes/improvement.ts	API route module. Contents not read.
6885	file	live code	not-opened	artifacts/api-server/src/routes/income-and-leads.ts	API route module. Contents not read.
7723	file	live code	opened	artifacts/api-server/src/routes/index.ts	Route table imported by the API app.
16605	file	live code	not-opened	artifacts/api-server/src/routes/ingestion.ts	API route module. Contents not read.
2264	file	live code	not-opened	artifacts/api-server/src/routes/intelligence-core.ts	API route module. Contents not read.
4776	file	live code	not-opened	artifacts/api-server/src/routes/internal-session-check.ts	API route module. Contents not read.
2481	file	live code	not-opened	artifacts/api-server/src/routes/invention-synthesis.ts	API route module. Contents not read.
106572	file	live code	not-opened	artifacts/api-server/src/routes/inventions.ts	API route module. Contents not read.
7206	file	live code	not-opened	artifacts/api-server/src/routes/knowledge-health.ts	API route module. Contents not read.
6891	file	live code	not-opened	artifacts/api-server/src/routes/knowledge-synthesis.ts	API route module. Contents not read.
16613	file	live code	not-opened	artifacts/api-server/src/routes/knowledge.ts	API route module. Contents not read.
3936	file	live code	not-opened	artifacts/api-server/src/routes/language-security.ts	API route module. Contents not read.
5999	file	live code	not-opened	artifacts/api-server/src/routes/lattice-hardware.ts	API route module. Contents not read.
13548	file	live code	not-opened	artifacts/api-server/src/routes/lattice.ts	API route module. Contents not read.
17357	file	live code	not-opened	artifacts/api-server/src/routes/legacy-engines.ts	API route module. Contents not read.
4619	file	live code	not-opened	artifacts/api-server/src/routes/local-models.ts	API route module. Contents not read.
5566	file	live code	not-opened	artifacts/api-server/src/routes/mandates.ts	API route module. Contents not read.
7794	file	live code	not-opened	artifacts/api-server/src/routes/memory.ts	API route module. Contents not read.
2489	file	live code	not-opened	artifacts/api-server/src/routes/mesh.ts	API route module. Contents not read.
641	file	live code	not-opened	artifacts/api-server/src/routes/meta-introspector.ts	API route module. Contents not read.
17833	file	live code	not-opened	artifacts/api-server/src/routes/mysticism.ts	API route module. Contents not read.
4113	file	live code	not-opened	artifacts/api-server/src/routes/natal-chart.ts	API route module. Contents not read.
9670	file	live code	not-opened	artifacts/api-server/src/routes/omniversal.ts	API route module. Contents not read.
17604	file	live code	not-opened	artifacts/api-server/src/routes/ontology.ts	API route module. Contents not read.
1921	file	live code	not-opened	artifacts/api-server/src/routes/operational-status.ts	API route module. Contents not read.
4192	file	live code	not-opened	artifacts/api-server/src/routes/prometheus-metrics.ts	API route module. Contents not read.
8554	file	live code	not-opened	artifacts/api-server/src/routes/provider-sovereignty.ts	API route module. Contents not read.
3337	file	live code	not-opened	artifacts/api-server/src/routes/reality-audit.ts	API route module. Contents not read.
20128	file	live code	not-opened	artifacts/api-server/src/routes/reasoning.ts	API route module. Contents not read.
1645	file	live code	not-opened	artifacts/api-server/src/routes/red-team.ts	API route module. Contents not read.
45499	file	live code	not-opened	artifacts/api-server/src/routes/rick.ts	API route module. Contents not read.
25806	file	live code	not-opened	artifacts/api-server/src/routes/roadmap.ts	API route module. Contents not read.
5233	file	live code	not-opened	artifacts/api-server/src/routes/routing.ts	API route module. Contents not read.
12063	file	live code	not-opened	artifacts/api-server/src/routes/sacred-conference.ts	API route module. Contents not read.
1544	file	live code	not-opened	artifacts/api-server/src/routes/sacred-geometry.ts	API route module. Contents not read.
10892	file	live code	not-opened	artifacts/api-server/src/routes/secret-knowledge.ts	API route module. Contents not read.
8496	file	live code	not-opened	artifacts/api-server/src/routes/security-defense.ts	API route module. Contents not read.
1798	file	live code	not-opened	artifacts/api-server/src/routes/security.ts	API route module. Contents not read.
44932	file	live code	not-opened	artifacts/api-server/src/routes/sovereign-data.ts	API route module. Contents not read.
24615	file	live code	not-opened	artifacts/api-server/src/routes/sovereign-doctrine.ts	API route module. Contents not read.
11149	file	live code	not-opened	artifacts/api-server/src/routes/sovereign-engines.ts	API route module. Contents not read.
1283	file	live code	not-opened	artifacts/api-server/src/routes/sovereign-grammar.ts	API route module. Contents not read.
8602	file	live code	not-opened	artifacts/api-server/src/routes/sovereign-infrastructure.ts	API route module. Contents not read.
14235	file	live code	not-opened	artifacts/api-server/src/routes/sovereign-language.ts	API route module. Contents not read.
2546	file	live code	not-opened	artifacts/api-server/src/routes/sovereign-ledger.ts	API route module. Contents not read.
3216	file	live code	not-opened	artifacts/api-server/src/routes/sovereignty-score.ts	API route module. Contents not read.
4699	file	live code	not-opened	artifacts/api-server/src/routes/sovereignty-self-check.ts	API route module. Contents not read.
7456	file	live code	not-opened	artifacts/api-server/src/routes/storage.ts	API route module. Contents not read.
10510	file	live code	not-opened	artifacts/api-server/src/routes/swarm.ts	API route module. Contents not read.
6133	file	live code	not-opened	artifacts/api-server/src/routes/system-metrics.ts	API route module. Contents not read.
4792	file	live code	not-opened	artifacts/api-server/src/routes/system-runtime.ts	API route module. Contents not read.
76559	file	live code	not-opened	artifacts/api-server/src/routes/tessera-bible.ts	API route module. Contents not read.
6372	file	live code	not-opened	artifacts/api-server/src/routes/tessera-codex.ts	API route module. Contents not read.
37883	file	live code	not-opened	artifacts/api-server/src/routes/theorem-lab.ts	API route module. Contents not read.
7123	file	live code	not-opened	artifacts/api-server/src/routes/training-evolution.ts	API route module. Contents not read.
5234	file	live code	not-opened	artifacts/api-server/src/routes/training.ts	API route module. Contents not read.
9536	file	live code	not-opened	artifacts/api-server/src/routes/universe.ts	API route module. Contents not read.
5438	file	live code	not-opened	artifacts/api-server/src/routes/world.ts	API route module. Contents not read.
271	file	live code	opened	artifacts/api-server/tsconfig.json	API typecheck project.
2280	file	docs	not-opened	artifacts/console/README.md	Console app file. Contents not read.
196	file	live code	not-opened	artifacts/console/check-node.mjs	Console app file. Contents not read.
1913	file	live code	opened	artifacts/console/hooks.mjs	Resolver that maps relative imports onto .ts files inside the repo.
8835	file	live code	not-opened	artifacts/console/lib/sources.mjs	Console app file. Contents not read.
600	file	live code	opened	artifacts/console/package.json	Console package. Node strip-types server, no extra dependencies.
2916	file	live code	not-opened	artifacts/console/public/actions.mjs	Console app file. Contents not read.
5144	file	live code	not-opened	artifacts/console/public/console.css	Console app file. Contents not read.
9242	file	live code	not-opened	artifacts/console/public/console.js	Console app file. Contents not read.
4402	file	duplicate	not-opened	artifacts/console/public/fonts/OFL.txt	Byte-identical to `preview/public/fonts/OFL.txt`. Console app file. Contents not read.
25344	file	duplicate	not-opened	artifacts/console/public/fonts/fragment-mono.woff2	Byte-identical to `preview/public/fonts/fragment-mono.woff2`. Console app file. Contents not read.
14180	file	duplicate	not-opened	artifacts/console/public/fonts/syne-500.woff2	Byte-identical to `preview/public/fonts/syne-500.woff2`. Console app file. Contents not read.
14152	file	duplicate	not-opened	artifacts/console/public/fonts/syne-700.woff2	Byte-identical to `preview/public/fonts/syne-700.woff2`. Console app file. Contents not read.
3428	file	live code	not-opened	artifacts/console/public/index.html	Console app file. Contents not read.
83	file	live code	opened	artifacts/console/register.mjs	Module register hook used to resolve extensionless TypeScript imports.
5856	file	live code	not-opened	artifacts/console/server.mjs	Console app file. Contents not read.
193	file	live code	not-opened	artifacts/console/stubs/pino.mjs	Console app file. Contents not read.
163	file	live code	not-opened	artifacts/console/stubs/tanstack-start.mjs	Console app file. Contents not read.
9888	file	live code	not-opened	artifacts/console/test/console.test.mjs	Console app file. Contents not read.
4199	file	docs	not-opened	artifacts/gitai/README.md	GitAI package file. Contents not read.
18507	file	live code	not-opened	artifacts/gitai/openapi.json	GitAI package file. Contents not read.
526	file	live code	opened	artifacts/gitai/package.json	GitAI marketplace package.
1980	file	live code	not-opened	artifacts/gitai/src/agent-keys.mjs	GitAI package file. Contents not read.
8119	file	live code	not-opened	artifacts/gitai/src/api.mjs	GitAI package file. Contents not read.
3190	file	live code	not-opened	artifacts/gitai/src/avatar.mjs	GitAI package file. Contents not read.
8578	file	live code	not-opened	artifacts/gitai/src/benchmarks.mjs	GitAI package file. Contents not read.
835	file	live code	not-opened	artifacts/gitai/src/index.mjs	GitAI package file. Contents not read.
996	file	live code	not-opened	artifacts/gitai/src/mesh.mjs	GitAI package file. Contents not read.
7497	file	live code	not-opened	artifacts/gitai/src/moltbook.mjs	GitAI package file. Contents not read.
11652	file	live code	not-opened	artifacts/gitai/src/page.mjs	GitAI package file. Contents not read.
23362	file	live code	not-opened	artifacts/gitai/src/platform.mjs	GitAI package file. Contents not read.
2531	file	live code	not-opened	artifacts/gitai/src/policy.mjs	GitAI package file. Contents not read.
2429	file	live code	not-opened	artifacts/gitai/src/probation.mjs	GitAI package file. Contents not read.
2219	file	live code	not-opened	artifacts/gitai/src/sandbox.mjs	GitAI package file. Contents not read.
3815	file	live code	not-opened	artifacts/gitai/src/seed.mjs	GitAI package file. Contents not read.
8439	file	live code	not-opened	artifacts/gitai/src/server.mjs	GitAI package file. Contents not read.
1958	file	live code	not-opened	artifacts/gitai/src/ws.mjs	GitAI package file. Contents not read.
5684	file	live code	not-opened	artifacts/gitai/test/agent-login.test.mjs	GitAI package file. Contents not read.
8827	file	live code	not-opened	artifacts/gitai/test/avatar-moltbook.test.mjs	GitAI package file. Contents not read.
19048	file	live code	not-opened	artifacts/gitai/test/gitai.test.mjs	GitAI package file. Contents not read.
5745	file	docs	not-opened	artifacts/gitbook-mcp/README.md	Gitbook MCP connector file. Contents not read.
2389	file	live code	not-opened	artifacts/gitbook-mcp/agents.json	Gitbook MCP connector file. Contents not read.
526	file	live code	opened	artifacts/gitbook-mcp/package.json	Gitbook MCP/HTTP connector package.
3043	file	live code	not-opened	artifacts/gitbook-mcp/src/config.ts	Gitbook MCP connector file. Contents not read.
2154	file	live code	not-opened	artifacts/gitbook-mcp/src/github.ts	Gitbook MCP connector file. Contents not read.
3273	file	live code	not-opened	artifacts/gitbook-mcp/src/http-server.ts	Gitbook MCP connector file. Contents not read.
849	file	live code	not-opened	artifacts/gitbook-mcp/src/http.ts	Gitbook MCP connector file. Contents not read.
391	file	live code	not-opened	artifacts/gitbook-mcp/src/index.ts	Gitbook MCP connector file. Contents not read.
4358	file	live code	not-opened	artifacts/gitbook-mcp/src/mcp-session.ts	Gitbook MCP connector file. Contents not read.
1861	file	live code	not-opened	artifacts/gitbook-mcp/src/mcp.ts	Gitbook MCP connector file. Contents not read.
1679	file	live code	not-opened	artifacts/gitbook-mcp/src/paths.ts	Gitbook MCP connector file. Contents not read.
5173	file	live code	not-opened	artifacts/gitbook-mcp/src/routing.ts	Gitbook MCP connector file. Contents not read.
520	file	live code	not-opened	artifacts/gitbook-mcp/src/runtime.ts	Gitbook MCP connector file. Contents not read.
23226	file	live code	not-opened	artifacts/gitbook-mcp/src/service.test.ts	Gitbook MCP connector file. Contents not read.
24787	file	live code	not-opened	artifacts/gitbook-mcp/src/service.ts	Gitbook MCP connector file. Contents not read.
222	file	live code	not-opened	artifacts/gitbook-mcp/tsconfig.json	Gitbook MCP connector file. Contents not read.
156	file	live code	not-opened	artifacts/gitbook-mcp/vitest.config.ts	Gitbook MCP connector file. Contents not read.
327	file	live code	not-opened	artifacts/mockup-sandbox/.replit-artifact/artifact.toml	Mockup sandbox file. Contents not read.
426	file	live code	not-opened	artifacts/mockup-sandbox/components.json	Mockup sandbox file. Contents not read.
4325	file	live code	not-opened	artifacts/mockup-sandbox/index.html	Mockup sandbox file. Contents not read.
4639	file	live code	not-opened	artifacts/mockup-sandbox/mockupPreviewPlugin.ts	Mockup sandbox file. Contents not read.
2511	file	live code	opened	artifacts/mockup-sandbox/package.json	Mockup sandbox package @workspace/mockup-sandbox.
665	file	live code	not-opened	artifacts/mockup-sandbox/src/.generated/mockup-components.ts	Mockup sandbox file. Contents not read.
3654	file	live code	not-opened	artifacts/mockup-sandbox/src/App.tsx	Mockup sandbox file. Contents not read.
4490	file	live code	not-opened	artifacts/mockup-sandbox/src/components/mockups/sovereign/CouncilVoteCard.tsx	Mockup sandbox file. Contents not read.
2911	file	live code	not-opened	artifacts/mockup-sandbox/src/components/mockups/sovereign/FrequencyMeter.tsx	Mockup sandbox file. Contents not read.
3736	file	live code	not-opened	artifacts/mockup-sandbox/src/components/mockups/sovereign/RedTeamTicker.tsx	Mockup sandbox file. Contents not read.
3530	file	live code	not-opened	artifacts/mockup-sandbox/src/components/mockups/sovereign/SovereigntyBadge.tsx	Mockup sandbox file. Contents not read.
2001	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/accordion.tsx	Byte-identical to `artifacts/tessera/src/components/ui/accordion.tsx`. Mockup sandbox file. Contents not read.
4419	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/alert-dialog.tsx	Byte-identical to `artifacts/tessera/src/components/ui/alert-dialog.tsx`. Mockup sandbox file. Contents not read.
1598	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/alert.tsx	Byte-identical to `artifacts/tessera/src/components/ui/alert.tsx`. Mockup sandbox file. Contents not read.
140	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/aspect-ratio.tsx	Byte-identical to `artifacts/tessera/src/components/ui/aspect-ratio.tsx`. Mockup sandbox file. Contents not read.
1419	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/avatar.tsx	Byte-identical to `artifacts/tessera/src/components/ui/avatar.tsx`. Mockup sandbox file. Contents not read.
1163	file	live code	not-opened	artifacts/mockup-sandbox/src/components/ui/badge.tsx	Mockup sandbox file. Contents not read.
2712	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/breadcrumb.tsx	Byte-identical to `artifacts/tessera/src/components/ui/breadcrumb.tsx`. Mockup sandbox file. Contents not read.
2209	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/button-group.tsx	Byte-identical to `artifacts/tessera/src/components/ui/button-group.tsx`. Mockup sandbox file. Contents not read.
1925	file	live code	not-opened	artifacts/mockup-sandbox/src/components/ui/button.tsx	Mockup sandbox file. Contents not read.
7608	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/calendar.tsx	Byte-identical to `artifacts/tessera/src/components/ui/calendar.tsx`. Mockup sandbox file. Contents not read.
1828	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/card.tsx	Byte-identical to `artifacts/tessera/src/components/ui/card.tsx`. Mockup sandbox file. Contents not read.
6210	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/carousel.tsx	Byte-identical to `artifacts/tessera/src/components/ui/carousel.tsx`. Mockup sandbox file. Contents not read.
10674	file	live code	not-opened	artifacts/mockup-sandbox/src/components/ui/chart.tsx	Mockup sandbox file. Contents not read.
1031	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/checkbox.tsx	Byte-identical to `artifacts/tessera/src/components/ui/checkbox.tsx`. Mockup sandbox file. Contents not read.
329	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/collapsible.tsx	Byte-identical to `artifacts/tessera/src/components/ui/collapsible.tsx`. Mockup sandbox file. Contents not read.
4887	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/command.tsx	Byte-identical to `artifacts/tessera/src/components/ui/command.tsx`. Mockup sandbox file. Contents not read.
7406	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/context-menu.tsx	Byte-identical to `artifacts/tessera/src/components/ui/context-menu.tsx`. Mockup sandbox file. Contents not read.
3835	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/dialog.tsx	Byte-identical to `artifacts/tessera/src/components/ui/dialog.tsx`. Mockup sandbox file. Contents not read.
3007	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/drawer.tsx	Byte-identical to `artifacts/tessera/src/components/ui/drawer.tsx`. Mockup sandbox file. Contents not read.
7606	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/dropdown-menu.tsx	Byte-identical to `artifacts/tessera/src/components/ui/dropdown-menu.tsx`. Mockup sandbox file. Contents not read.
2396	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/empty.tsx	Byte-identical to `artifacts/tessera/src/components/ui/empty.tsx`. Mockup sandbox file. Contents not read.
6044	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/field.tsx	Byte-identical to `artifacts/tessera/src/components/ui/field.tsx`. Mockup sandbox file. Contents not read.
4175	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/form.tsx	Byte-identical to `artifacts/tessera/src/components/ui/form.tsx`. Mockup sandbox file. Contents not read.
1237	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/hover-card.tsx	Byte-identical to `artifacts/tessera/src/components/ui/hover-card.tsx`. Mockup sandbox file. Contents not read.
4883	file	live code	not-opened	artifacts/mockup-sandbox/src/components/ui/input-group.tsx	Mockup sandbox file. Contents not read.
2143	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/input-otp.tsx	Byte-identical to `artifacts/tessera/src/components/ui/input-otp.tsx`. Mockup sandbox file. Contents not read.
768	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/input.tsx	Byte-identical to `artifacts/tessera/src/components/ui/input.tsx`. Mockup sandbox file. Contents not read.
4494	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/item.tsx	Byte-identical to `artifacts/tessera/src/components/ui/item.tsx`. Mockup sandbox file. Contents not read.
862	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/kbd.tsx	Byte-identical to `artifacts/tessera/src/components/ui/kbd.tsx`. Mockup sandbox file. Contents not read.
724	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/label.tsx	Byte-identical to `artifacts/tessera/src/components/ui/label.tsx`. Mockup sandbox file. Contents not read.
8608	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/menubar.tsx	Byte-identical to `artifacts/tessera/src/components/ui/menubar.tsx`. Mockup sandbox file. Contents not read.
5124	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/navigation-menu.tsx	Byte-identical to `artifacts/tessera/src/components/ui/navigation-menu.tsx`. Mockup sandbox file. Contents not read.
2751	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/pagination.tsx	Byte-identical to `artifacts/tessera/src/components/ui/pagination.tsx`. Mockup sandbox file. Contents not read.
1342	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/popover.tsx	Byte-identical to `artifacts/tessera/src/components/ui/popover.tsx`. Mockup sandbox file. Contents not read.
792	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/progress.tsx	Byte-identical to `artifacts/tessera/src/components/ui/progress.tsx`. Mockup sandbox file. Contents not read.
1410	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/radio-group.tsx	Byte-identical to `artifacts/tessera/src/components/ui/radio-group.tsx`. Mockup sandbox file. Contents not read.
1723	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/resizable.tsx	Byte-identical to `artifacts/tessera/src/components/ui/resizable.tsx`. Mockup sandbox file. Contents not read.
1642	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/scroll-area.tsx	Byte-identical to `artifacts/tessera/src/components/ui/scroll-area.tsx`. Mockup sandbox file. Contents not read.
5745	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/select.tsx	Byte-identical to `artifacts/tessera/src/components/ui/select.tsx`. Mockup sandbox file. Contents not read.
756	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/separator.tsx	Byte-identical to `artifacts/tessera/src/components/ui/separator.tsx`. Mockup sandbox file. Contents not read.
4280	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/sheet.tsx	Byte-identical to `artifacts/tessera/src/components/ui/sheet.tsx`. Mockup sandbox file. Contents not read.
21056	file	live code	not-opened	artifacts/mockup-sandbox/src/components/ui/sidebar.tsx	Mockup sandbox file. Contents not read.
266	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/skeleton.tsx	Byte-identical to `artifacts/tessera/src/components/ui/skeleton.tsx`. Mockup sandbox file. Contents not read.
1037	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/slider.tsx	Byte-identical to `artifacts/tessera/src/components/ui/slider.tsx`. Mockup sandbox file. Contents not read.
894	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/sonner.tsx	Byte-identical to `artifacts/tessera/src/components/ui/sonner.tsx`. Mockup sandbox file. Contents not read.
331	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/spinner.tsx	Byte-identical to `artifacts/tessera/src/components/ui/spinner.tsx`. Mockup sandbox file. Contents not read.
1148	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/switch.tsx	Byte-identical to `artifacts/tessera/src/components/ui/switch.tsx`. Mockup sandbox file. Contents not read.
2859	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/table.tsx	Byte-identical to `artifacts/tessera/src/components/ui/table.tsx`. Mockup sandbox file. Contents not read.
1877	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/tabs.tsx	Byte-identical to `artifacts/tessera/src/components/ui/tabs.tsx`. Mockup sandbox file. Contents not read.
649	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/textarea.tsx	Byte-identical to `artifacts/tessera/src/components/ui/textarea.tsx`. Mockup sandbox file. Contents not read.
4845	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/toast.tsx	Byte-identical to `artifacts/tessera/src/components/ui/toast.tsx`. Mockup sandbox file. Contents not read.
772	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/toaster.tsx	Byte-identical to `artifacts/tessera/src/components/ui/toaster.tsx`. Mockup sandbox file. Contents not read.
1753	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/toggle-group.tsx	Byte-identical to `artifacts/tessera/src/components/ui/toggle-group.tsx`. Mockup sandbox file. Contents not read.
1486	file	duplicate	not-opened	artifacts/mockup-sandbox/src/components/ui/toggle.tsx	Byte-identical to `artifacts/tessera/src/components/ui/toggle.tsx`. Mockup sandbox file. Contents not read.
1267	file	live code	not-opened	artifacts/mockup-sandbox/src/components/ui/tooltip.tsx	Mockup sandbox file. Contents not read.
565	file	duplicate	not-opened	artifacts/mockup-sandbox/src/hooks/use-mobile.tsx	Byte-identical to `artifacts/tessera/src/hooks/use-mobile.tsx`. Mockup sandbox file. Contents not read.
3767	file	live code	not-opened	artifacts/mockup-sandbox/src/hooks/use-toast.ts	Mockup sandbox file. Contents not read.
4967	file	live code	not-opened	artifacts/mockup-sandbox/src/index.css	Mockup sandbox file. Contents not read.
166	file	duplicate	not-opened	artifacts/mockup-sandbox/src/lib/utils.ts	Byte-identical to `artifacts/tessera/src/lib/utils.ts`. Mockup sandbox file. Contents not read.
157	file	live code	not-opened	artifacts/mockup-sandbox/src/main.tsx	Mockup sandbox file. Contents not read.
449	file	live code	not-opened	artifacts/mockup-sandbox/tsconfig.json	Mockup sandbox file. Contents not read.
2035	file	live code	not-opened	artifacts/mockup-sandbox/vite.config.ts	Mockup sandbox file. Contents not read.
1129	file	live code	not-opened	artifacts/nextgen/lib/metacognition-view.ts	Nextgen package file. Contents not read.
2670	file	live code	not-opened	artifacts/nextgen/lib/world.mjs	Nextgen package file. Contents not read.
443	file	live code	opened	artifacts/nextgen/package.json	Nextgen UI package.
4374	file	live code	not-opened	artifacts/nextgen/public/app.js	Nextgen package file. Contents not read.
1362	file	live code	not-opened	artifacts/nextgen/public/index.html	Nextgen package file. Contents not read.
2604	file	live code	not-opened	artifacts/nextgen/server.mjs	Nextgen package file. Contents not read.
1891	file	live code	not-opened	artifacts/nextgen/test/nextgen.test.mjs	Nextgen package file. Contents not read.
584	file	live code	not-opened	artifacts/tessera/.replit-artifact/artifact.toml	Tessera web app file. Contents not read.
434	file	live code	not-opened	artifacts/tessera/components.json	Tessera web app file. Contents not read.
802	file	live code	not-opened	artifacts/tessera/index.html	Tessera web app file. Contents not read.
3123	file	live code	opened	artifacts/tessera/package.json	Web package @workspace/tessera (Vite).
163	file	live code	not-opened	artifacts/tessera/public/favicon.svg	Tessera web app file. Contents not read.
15836	file	live code	not-opened	artifacts/tessera/public/fonts/SpaceMono.woff2	Tessera web app file. Contents not read.
9790	file	live code	not-opened	artifacts/tessera/public/manus-routes.json	Tessera web app file. Contents not read.
30400	file	live code	not-opened	artifacts/tessera/public/opengraph.jpg	Tessera web app file. Contents not read.
114772	file	live code	not-opened	artifacts/tessera/public/textures/planets/earth.jpg	Tessera web app file. Contents not read.
53113	file	live code	not-opened	artifacts/tessera/public/textures/planets/jupiter.jpg	Tessera web app file. Contents not read.
43646	file	live code	not-opened	artifacts/tessera/public/textures/planets/mars.jpg	Tessera web app file. Contents not read.
49955	file	live code	not-opened	artifacts/tessera/public/textures/planets/mercury.jpg	Tessera web app file. Contents not read.
30648	file	live code	not-opened	artifacts/tessera/public/textures/planets/neptune.jpg	Tessera web app file. Contents not read.
11711	file	live code	not-opened	artifacts/tessera/public/textures/planets/saturn.jpg	Tessera web app file. Contents not read.
19637	file	live code	not-opened	artifacts/tessera/public/textures/planets/uranus.jpg	Tessera web app file. Contents not read.
31275	file	live code	not-opened	artifacts/tessera/public/textures/planets/venus.jpg	Tessera web app file. Contents not read.
18128	file	live code	not-opened	artifacts/tessera/src/App.tsx	Tessera web app file. Contents not read.
23986	file	live code	not-opened	artifacts/tessera/src/components/AISwarmTab.tsx	Tessera web app file. Contents not read.
4137	file	live code	not-opened	artifacts/tessera/src/components/ActiveCommandsOverlay.tsx	Tessera web app file. Contents not read.
1363	file	live code	not-opened	artifacts/tessera/src/components/AdminGate.tsx	Tessera web app file. Contents not read.
6572	file	live code	not-opened	artifacts/tessera/src/components/AdminKeyInput.tsx	Tessera web app file. Contents not read.
59521	file	live code	not-opened	artifacts/tessera/src/components/ChatArea.tsx	Tessera web app file. Contents not read.
6582	file	live code	not-opened	artifacts/tessera/src/components/CommandPalette.tsx	Tessera web app file. Contents not read.
4161	file	live code	not-opened	artifacts/tessera/src/components/ConversationSearch.tsx	Tessera web app file. Contents not read.
5036	file	live code	not-opened	artifacts/tessera/src/components/HumanActionPanel.tsx	Tessera web app file. Contents not read.
3405	file	live code	not-opened	artifacts/tessera/src/components/InventionModelPreview.tsx	Tessera web app file. Contents not read.
10438	file	live code	not-opened	artifacts/tessera/src/components/KnowledgeGraph.tsx	Tessera web app file. Contents not read.
6689	file	live code	not-opened	artifacts/tessera/src/components/KnowledgeSearch.tsx	Tessera web app file. Contents not read.
4833	file	live code	not-opened	artifacts/tessera/src/components/LiveProcessTracker.tsx	Tessera web app file. Contents not read.
2312	file	live code	not-opened	artifacts/tessera/src/components/MeshStatusBadge.tsx	Tessera web app file. Contents not read.
10708	file	live code	not-opened	artifacts/tessera/src/components/MobileNav.tsx	Tessera web app file. Contents not read.
27034	file	live code	not-opened	artifacts/tessera/src/components/NatalChartSection.tsx	Tessera web app file. Contents not read.
3964	file	live code	not-opened	artifacts/tessera/src/components/PageTabs.tsx	Tessera web app file. Contents not read.
4159	file	live code	not-opened	artifacts/tessera/src/components/ResponseFeedback.tsx	Tessera web app file. Contents not read.
2910	file	live code	not-opened	artifacts/tessera/src/components/SectionErrorBoundary.tsx	Tessera web app file. Contents not read.
22876	file	live code	not-opened	artifacts/tessera/src/components/Sidebar.tsx	Tessera web app file. Contents not read.
60237	file	live code	not-opened	artifacts/tessera/src/components/SolarSystem3D.tsx	Tessera web app file. Contents not read.
3849	file	live code	not-opened	artifacts/tessera/src/components/SourcedSecretsPanel.tsx	Tessera web app file. Contents not read.
12842	file	live code	not-opened	artifacts/tessera/src/components/SovereignInfrastructureDashboard.tsx	Tessera web app file. Contents not read.
19153	file	live code	not-opened	artifacts/tessera/src/components/SovereignInstall.tsx	Tessera web app file. Contents not read.
3809	file	live code	not-opened	artifacts/tessera/src/components/SplashScreen.tsx	Tessera web app file. Contents not read.
7629	file	live code	not-opened	artifacts/tessera/src/components/SystemHealthPulse.tsx	Tessera web app file. Contents not read.
2941	file	live code	not-opened	artifacts/tessera/src/components/SystemSpecsBar.tsx	Tessera web app file. Contents not read.
12357	file	live code	not-opened	artifacts/tessera/src/components/TesseractKeyGate.tsx	Tessera web app file. Contents not read.
2327	file	live code	not-opened	artifacts/tessera/src/components/chat/ChamberBar.tsx	Tessera web app file. Contents not read.
2621	file	live code	not-opened	artifacts/tessera/src/components/chat/Chat3DParser.ts	Tessera web app file. Contents not read.
1174	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatChartRenderer.tsx	Tessera web app file. Contents not read.
1041	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatCodePreview.tsx	Tessera web app file. Contents not read.
1869	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatColorizedText.tsx	Tessera web app file. Contents not read.
17046	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatCommands.ts	Tessera web app file. Contents not read.
1765	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatDataCommandResult.tsx	Tessera web app file. Contents not read.
5085	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatFileComponents.tsx	Tessera web app file. Contents not read.
1564	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatFileUploadArea.tsx	Tessera web app file. Contents not read.
6310	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatInputToolbar.tsx	Tessera web app file. Contents not read.
5104	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatKeyboardShortcuts.tsx	Tessera web app file. Contents not read.
22253	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatLatticePanel.tsx	Tessera web app file. Contents not read.
18141	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatMessageItem.tsx	Tessera web app file. Contents not read.
8128	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatMessageList.tsx	Tessera web app file. Contents not read.
37854	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatObject3D.tsx	Tessera web app file. Contents not read.
3177	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatPanels.tsx	Tessera web app file. Contents not read.
7993	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatStreamingMessage.tsx	Tessera web app file. Contents not read.
6200	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatSummitFeedPanel.tsx	Tessera web app file. Contents not read.
5603	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatVoice.tsx	Tessera web app file. Contents not read.
6935	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatVoiceModeOverlay.tsx	Tessera web app file. Contents not read.
3001	file	live code	not-opened	artifacts/tessera/src/components/chat/ChatVoiceSpeedControl.tsx	Tessera web app file. Contents not read.
11448	file	live code	not-opened	artifacts/tessera/src/components/chat/CodeExecutionResult.tsx	Tessera web app file. Contents not read.
7943	file	live code	not-opened	artifacts/tessera/src/components/chat/MyKeyRevealModal.tsx	Tessera web app file. Contents not read.
6076	file	live code	not-opened	artifacts/tessera/src/components/chat/NLPGoalsPanel.tsx	Tessera web app file. Contents not read.
5504	file	live code	not-opened	artifacts/tessera/src/components/chat/useChatCommandExecutor.ts	Tessera web app file. Contents not read.
3395	file	live code	not-opened	artifacts/tessera/src/components/intelligence/DAGGraph.tsx	Tessera web app file. Contents not read.
3077	file	live code	not-opened	artifacts/tessera/src/components/intelligence/RiskHeatMap.tsx	Tessera web app file. Contents not read.
3821	file	live code	not-opened	artifacts/tessera/src/components/intelligence/SimCompareTable.tsx	Tessera web app file. Contents not read.
3857	file	live code	not-opened	artifacts/tessera/src/components/intelligence/TemplatePicker.tsx	Tessera web app file. Contents not read.
1127	file	live code	not-opened	artifacts/tessera/src/components/ui/QueryErrorFallback.tsx	Tessera web app file. Contents not read.
2001	file	live code	not-opened	artifacts/tessera/src/components/ui/accordion.tsx	Tessera web app file. Contents not read.
4419	file	live code	not-opened	artifacts/tessera/src/components/ui/alert-dialog.tsx	Tessera web app file. Contents not read.
1598	file	live code	not-opened	artifacts/tessera/src/components/ui/alert.tsx	Tessera web app file. Contents not read.
140	file	live code	not-opened	artifacts/tessera/src/components/ui/aspect-ratio.tsx	Tessera web app file. Contents not read.
1419	file	live code	not-opened	artifacts/tessera/src/components/ui/avatar.tsx	Tessera web app file. Contents not read.
1522	file	live code	not-opened	artifacts/tessera/src/components/ui/badge.tsx	Tessera web app file. Contents not read.
2712	file	live code	not-opened	artifacts/tessera/src/components/ui/breadcrumb.tsx	Tessera web app file. Contents not read.
2209	file	live code	not-opened	artifacts/tessera/src/components/ui/button-group.tsx	Tessera web app file. Contents not read.
2356	file	live code	not-opened	artifacts/tessera/src/components/ui/button.tsx	Tessera web app file. Contents not read.
7608	file	live code	not-opened	artifacts/tessera/src/components/ui/calendar.tsx	Tessera web app file. Contents not read.
1828	file	live code	not-opened	artifacts/tessera/src/components/ui/card.tsx	Tessera web app file. Contents not read.
6210	file	live code	not-opened	artifacts/tessera/src/components/ui/carousel.tsx	Tessera web app file. Contents not read.
10763	file	live code	not-opened	artifacts/tessera/src/components/ui/chart.tsx	Tessera web app file. Contents not read.
1031	file	live code	not-opened	artifacts/tessera/src/components/ui/checkbox.tsx	Tessera web app file. Contents not read.
329	file	live code	not-opened	artifacts/tessera/src/components/ui/collapsible.tsx	Tessera web app file. Contents not read.
4887	file	live code	not-opened	artifacts/tessera/src/components/ui/command.tsx	Tessera web app file. Contents not read.
7406	file	live code	not-opened	artifacts/tessera/src/components/ui/context-menu.tsx	Tessera web app file. Contents not read.
3835	file	live code	not-opened	artifacts/tessera/src/components/ui/dialog.tsx	Tessera web app file. Contents not read.
3007	file	live code	not-opened	artifacts/tessera/src/components/ui/drawer.tsx	Tessera web app file. Contents not read.
7606	file	live code	not-opened	artifacts/tessera/src/components/ui/dropdown-menu.tsx	Tessera web app file. Contents not read.
2396	file	live code	not-opened	artifacts/tessera/src/components/ui/empty.tsx	Tessera web app file. Contents not read.
6044	file	live code	not-opened	artifacts/tessera/src/components/ui/field.tsx	Tessera web app file. Contents not read.
4175	file	live code	not-opened	artifacts/tessera/src/components/ui/form.tsx	Tessera web app file. Contents not read.
1237	file	live code	not-opened	artifacts/tessera/src/components/ui/hover-card.tsx	Tessera web app file. Contents not read.
4971	file	live code	not-opened	artifacts/tessera/src/components/ui/input-group.tsx	Tessera web app file. Contents not read.
2143	file	live code	not-opened	artifacts/tessera/src/components/ui/input-otp.tsx	Tessera web app file. Contents not read.
768	file	live code	not-opened	artifacts/tessera/src/components/ui/input.tsx	Tessera web app file. Contents not read.
4494	file	live code	not-opened	artifacts/tessera/src/components/ui/item.tsx	Tessera web app file. Contents not read.
862	file	live code	not-opened	artifacts/tessera/src/components/ui/kbd.tsx	Tessera web app file. Contents not read.
724	file	live code	not-opened	artifacts/tessera/src/components/ui/label.tsx	Tessera web app file. Contents not read.
8608	file	live code	not-opened	artifacts/tessera/src/components/ui/menubar.tsx	Tessera web app file. Contents not read.
5124	file	live code	not-opened	artifacts/tessera/src/components/ui/navigation-menu.tsx	Tessera web app file. Contents not read.
2751	file	live code	not-opened	artifacts/tessera/src/components/ui/pagination.tsx	Tessera web app file. Contents not read.
1342	file	live code	not-opened	artifacts/tessera/src/components/ui/popover.tsx	Tessera web app file. Contents not read.
792	file	live code	not-opened	artifacts/tessera/src/components/ui/progress.tsx	Tessera web app file. Contents not read.
1410	file	live code	not-opened	artifacts/tessera/src/components/ui/radio-group.tsx	Tessera web app file. Contents not read.
1723	file	live code	not-opened	artifacts/tessera/src/components/ui/resizable.tsx	Tessera web app file. Contents not read.
1642	file	live code	not-opened	artifacts/tessera/src/components/ui/scroll-area.tsx	Tessera web app file. Contents not read.
5745	file	live code	not-opened	artifacts/tessera/src/components/ui/select.tsx	Tessera web app file. Contents not read.
756	file	live code	not-opened	artifacts/tessera/src/components/ui/separator.tsx	Tessera web app file. Contents not read.
4280	file	live code	not-opened	artifacts/tessera/src/components/ui/sheet.tsx	Tessera web app file. Contents not read.
21846	file	live code	not-opened	artifacts/tessera/src/components/ui/sidebar.tsx	Tessera web app file. Contents not read.
266	file	live code	not-opened	artifacts/tessera/src/components/ui/skeleton.tsx	Tessera web app file. Contents not read.
1037	file	live code	not-opened	artifacts/tessera/src/components/ui/slider.tsx	Tessera web app file. Contents not read.
894	file	live code	not-opened	artifacts/tessera/src/components/ui/sonner.tsx	Tessera web app file. Contents not read.
18682	file	live code	not-opened	artifacts/tessera/src/components/ui/sovereign.tsx	Tessera web app file. Contents not read.
331	file	live code	not-opened	artifacts/tessera/src/components/ui/spinner.tsx	Tessera web app file. Contents not read.
1148	file	live code	not-opened	artifacts/tessera/src/components/ui/switch.tsx	Tessera web app file. Contents not read.
2859	file	live code	not-opened	artifacts/tessera/src/components/ui/table.tsx	Tessera web app file. Contents not read.
1877	file	live code	not-opened	artifacts/tessera/src/components/ui/tabs.tsx	Tessera web app file. Contents not read.
649	file	live code	not-opened	artifacts/tessera/src/components/ui/textarea.tsx	Tessera web app file. Contents not read.
4845	file	live code	not-opened	artifacts/tessera/src/components/ui/toast.tsx	Tessera web app file. Contents not read.
772	file	live code	not-opened	artifacts/tessera/src/components/ui/toaster.tsx	Tessera web app file. Contents not read.
1753	file	live code	not-opened	artifacts/tessera/src/components/ui/toggle-group.tsx	Tessera web app file. Contents not read.
1486	file	live code	not-opened	artifacts/tessera/src/components/ui/toggle.tsx	Tessera web app file. Contents not read.
1253	file	live code	not-opened	artifacts/tessera/src/components/ui/tooltip.tsx	Tessera web app file. Contents not read.
44566	file	live code	not-opened	artifacts/tessera/src/data/star-catalog.ts	Tessera web app file. Contents not read.
2573	file	live code	not-opened	artifacts/tessera/src/hooks/use-bookmarks.ts	Tessera web app file. Contents not read.
23863	file	live code	not-opened	artifacts/tessera/src/hooks/use-chat.ts	Tessera web app file. Contents not read.
2641	file	live code	not-opened	artifacts/tessera/src/hooks/use-conversations.ts	Tessera web app file. Contents not read.
565	file	live code	not-opened	artifacts/tessera/src/hooks/use-mobile.tsx	Tessera web app file. Contents not read.
1958	file	live code	not-opened	artifacts/tessera/src/hooks/use-repos.ts	Tessera web app file. Contents not read.
1439	file	live code	not-opened	artifacts/tessera/src/hooks/use-smart-refetch.ts	Tessera web app file. Contents not read.
3895	file	live code	not-opened	artifacts/tessera/src/hooks/use-toast.ts	Tessera web app file. Contents not read.
2597	file	live code	not-opened	artifacts/tessera/src/hooks/useDAGStream.ts	Tessera web app file. Contents not read.
15021	file	live code	not-opened	artifacts/tessera/src/index.css	Tessera web app file. Contents not read.
7118	file	live code	not-opened	artifacts/tessera/src/lib/adminContext.tsx	Tessera web app file. Contents not read.
10720	file	live code	not-opened	artifacts/tessera/src/lib/colonial-tokens.ts	Tessera web app file. Contents not read.
155	file	live code	not-opened	artifacts/tessera/src/lib/entityData.ts	Tessera web app file. Contents not read.
37893	file	live code	not-opened	artifacts/tessera/src/lib/ephemeris.ts	Tessera web app file. Contents not read.
700	file	live code	not-opened	artifacts/tessera/src/lib/jitter.ts	Tessera web app file. Contents not read.
22091	file	live code	not-opened	artifacts/tessera/src/lib/lattice-mesh.ts	Tessera web app file. Contents not read.
11598	file	live code	not-opened	artifacts/tessera/src/lib/meshContext.tsx	Tessera web app file. Contents not read.
5165	file	live code	not-opened	artifacts/tessera/src/lib/nlpGoalEngine.ts	Tessera web app file. Contents not read.
1659	file	live code	not-opened	artifacts/tessera/src/lib/nlpGoalsContext.tsx	Tessera web app file. Contents not read.
1534	file	live code	not-opened	artifacts/tessera/src/lib/nlpTechniques.ts	Tessera web app file. Contents not read.
1276	file	live code	not-opened	artifacts/tessera/src/lib/operational-cycle.test.ts	Tessera web app file. Contents not read.
1987	file	live code	not-opened	artifacts/tessera/src/lib/operational-cycle.ts	Tessera web app file. Contents not read.
11782	file	live code	not-opened	artifacts/tessera/src/lib/puter-ai.ts	Tessera web app file. Contents not read.
5169	file	live code	not-opened	artifacts/tessera/src/lib/queryClient.ts	Tessera web app file. Contents not read.
43088	file	live code	not-opened	artifacts/tessera/src/lib/sovereign-charts.tsx	Tessera web app file. Contents not read.
11515	file	live code	not-opened	artifacts/tessera/src/lib/sovereign-motion.tsx	Tessera web app file. Contents not read.
9105	file	live code	not-opened	artifacts/tessera/src/lib/sovereign-query.ts	Tessera web app file. Contents not read.
14162	file	live code	not-opened	artifacts/tessera/src/lib/sovereign-rules.ts	Tessera web app file. Contents not read.
40367	file	live code	not-opened	artifacts/tessera/src/lib/swarm-agents.ts	Tessera web app file. Contents not read.
3685	file	live code	not-opened	artifacts/tessera/src/lib/tessera-voice.ts	Tessera web app file. Contents not read.
662	file	live code	not-opened	artifacts/tessera/src/lib/types.ts	Tessera web app file. Contents not read.
166	file	live code	not-opened	artifacts/tessera/src/lib/utils.ts	Tessera web app file. Contents not read.
3541	file	live code	not-opened	artifacts/tessera/src/lib/websocket.ts	Tessera web app file. Contents not read.
206	file	live code	not-opened	artifacts/tessera/src/main.tsx	Tessera web app file. Contents not read.
9834	file	live code	not-opened	artifacts/tessera/src/pages/AGICorePage.tsx	Tessera web app file. Contents not read.
7834	file	live code	not-opened	artifacts/tessera/src/pages/APIMarketplacePage.tsx	Tessera web app file. Contents not read.
7557	file	live code	not-opened	artifacts/tessera/src/pages/AffiliateMarketingPage.tsx	Tessera web app file. Contents not read.
6551	file	live code	not-opened	artifacts/tessera/src/pages/AgentDeclarationsPage.tsx	Tessera web app file. Contents not read.
18669	file	live code	not-opened	artifacts/tessera/src/pages/AgentDirectoryPage.tsx	Tessera web app file. Contents not read.
5983	file	live code	not-opened	artifacts/tessera/src/pages/AgentLivePage.tsx	Tessera web app file. Contents not read.
279	file	live code	not-opened	artifacts/tessera/src/pages/AgentNFTPage.tsx	Tessera web app file. Contents not read.
9189	file	live code	not-opened	artifacts/tessera/src/pages/AgentProfilePage.tsx	Tessera web app file. Contents not read.
6627	file	live code	not-opened	artifacts/tessera/src/pages/ArbitragePage.tsx	Tessera web app file. Contents not read.
8159	file	live code	not-opened	artifacts/tessera/src/pages/AutoHealerPage.tsx	Tessera web app file. Contents not read.
637	file	live code	not-opened	artifacts/tessera/src/pages/BibleHubPage.tsx	Tessera web app file. Contents not read.
14935	file	live code	not-opened	artifacts/tessera/src/pages/BuildPage.tsx	Tessera web app file. Contents not read.
7523	file	live code	not-opened	artifacts/tessera/src/pages/BusinessIdeasPage.tsx	Tessera web app file. Contents not read.
1465	file	live code	not-opened	artifacts/tessera/src/pages/ChatPage.tsx	Tessera web app file. Contents not read.
7359	file	live code	not-opened	artifacts/tessera/src/pages/CodeBuilderPage.tsx	Tessera web app file. Contents not read.
670	file	live code	not-opened	artifacts/tessera/src/pages/CodeHubPage.tsx	Tessera web app file. Contents not read.
18859	file	live code	not-opened	artifacts/tessera/src/pages/CodexPage.tsx	Tessera web app file. Contents not read.
8336	file	live code	not-opened	artifacts/tessera/src/pages/CommandCenterPage.tsx	Tessera web app file. Contents not read.
668	file	live code	not-opened	artifacts/tessera/src/pages/CommandHubPage.tsx	Tessera web app file. Contents not read.
16932	file	live code	not-opened	artifacts/tessera/src/pages/CompressionLabPage.tsx	Tessera web app file. Contents not read.
152	file	live code	not-opened	artifacts/tessera/src/pages/ConclusionsPage.tsx	Tessera web app file. Contents not read.
11160	file	live code	not-opened	artifacts/tessera/src/pages/ConsciousnessNexusPage.tsx	Tessera web app file. Contents not read.
3639	file	live code	not-opened	artifacts/tessera/src/pages/CouncilLedgerPage.tsx	Tessera web app file. Contents not read.
8221	file	live code	not-opened	artifacts/tessera/src/pages/CouncilTranscriptPage.tsx	Tessera web app file. Contents not read.
6581	file	live code	not-opened	artifacts/tessera/src/pages/CredentialsPage.tsx	Tessera web app file. Contents not read.
6299	file	live code	not-opened	artifacts/tessera/src/pages/CrossAppBridgePage.tsx	Tessera web app file. Contents not read.
15099	file	live code	not-opened	artifacts/tessera/src/pages/DepartmentsPage.tsx	Tessera web app file. Contents not read.
5837	file	live code	not-opened	artifacts/tessera/src/pages/EcomPage.tsx	Tessera web app file. Contents not read.
648	file	live code	not-opened	artifacts/tessera/src/pages/FinanceHubPage.tsx	Tessera web app file. Contents not read.
7217	file	live code	not-opened	artifacts/tessera/src/pages/FinancePage.tsx	Tessera web app file. Contents not read.
8529	file	live code	not-opened	artifacts/tessera/src/pages/FleetPage.tsx	Tessera web app file. Contents not read.
10118	file	live code	not-opened	artifacts/tessera/src/pages/GalleryPage.tsx	Tessera web app file. Contents not read.
17155	file	live code	not-opened	artifacts/tessera/src/pages/GrandCouncilDeliberationPage.tsx	Tessera web app file. Contents not read.
32364	file	live code	not-opened	artifacts/tessera/src/pages/GrandCouncilPage.tsx	Tessera web app file. Contents not read.
13825	file	live code	not-opened	artifacts/tessera/src/pages/GrandEvolutionPage.tsx	Tessera web app file. Contents not read.
29917	file	live code	not-opened	artifacts/tessera/src/pages/GrandNarrativePage.tsx	Tessera web app file. Contents not read.
4817	file	live code	not-opened	artifacts/tessera/src/pages/HistoryPage.tsx	Tessera web app file. Contents not read.
8413	file	live code	not-opened	artifacts/tessera/src/pages/IncomeWorkflowPage.tsx	Tessera web app file. Contents not read.
11684	file	live code	not-opened	artifacts/tessera/src/pages/IntelligencePage.tsx	Tessera web app file. Contents not read.
19405	file	live code	not-opened	artifacts/tessera/src/pages/LatticeBrowserPage.tsx	Tessera web app file. Contents not read.
5393	file	live code	not-opened	artifacts/tessera/src/pages/LeadGenPage.tsx	Tessera web app file. Contents not read.
907	file	live code	not-opened	artifacts/tessera/src/pages/LeadsHubPage.tsx	Tessera web app file. Contents not read.
17167	file	live code	not-opened	artifacts/tessera/src/pages/LifePage.tsx	Tessera web app file. Contents not read.
6673	file	live code	not-opened	artifacts/tessera/src/pages/LocalServicesPage.tsx	Tessera web app file. Contents not read.
5579	file	live code	not-opened	artifacts/tessera/src/pages/MarketDashboardPage.tsx	Tessera web app file. Contents not read.
15602	file	live code	not-opened	artifacts/tessera/src/pages/MembersPage.tsx	Tessera web app file. Contents not read.
193	file	live code	not-opened	artifacts/tessera/src/pages/NFTHubPage.tsx	Tessera web app file. Contents not read.
9231	file	live code	not-opened	artifacts/tessera/src/pages/NLPPage.tsx	Tessera web app file. Contents not read.
10063	file	live code	not-opened	artifacts/tessera/src/pages/NextFivePage.tsx	Tessera web app file. Contents not read.
20626	file	live code	not-opened	artifacts/tessera/src/pages/OmniversalLatticePage.tsx	Tessera web app file. Contents not read.
11246	file	live code	not-opened	artifacts/tessera/src/pages/OperationalCyclePage.tsx	Tessera web app file. Contents not read.
7848	file	live code	not-opened	artifacts/tessera/src/pages/ProofCenterPage.tsx	Tessera web app file. Contents not read.
11441	file	live code	not-opened	artifacts/tessera/src/pages/RecruitmentPage.tsx	Tessera web app file. Contents not read.
127798	file	live code	not-opened	artifacts/tessera/src/pages/RickPage.tsx	Tessera web app file. Contents not read.
559	file	live code	not-opened	artifacts/tessera/src/pages/RoadmapHubPage.tsx	Tessera web app file. Contents not read.
12108	file	live code	not-opened	artifacts/tessera/src/pages/RoyalAppointmentsPage.tsx	Tessera web app file. Contents not read.
12002	file	live code	not-opened	artifacts/tessera/src/pages/RoyalCourtPage.tsx	Tessera web app file. Contents not read.
9151	file	live code	not-opened	artifacts/tessera/src/pages/RoyalRolePage.tsx	Tessera web app file. Contents not read.
8279	file	live code	not-opened	artifacts/tessera/src/pages/RulesPage.tsx	Tessera web app file. Contents not read.
7548	file	live code	not-opened	artifacts/tessera/src/pages/SEOResearchPage.tsx	Tessera web app file. Contents not read.
42382	file	live code	not-opened	artifacts/tessera/src/pages/SacredConferencePage.tsx	Tessera web app file. Contents not read.
80998	file	live code	not-opened	artifacts/tessera/src/pages/SecretKnowledgePage.tsx	Tessera web app file. Contents not read.
7239	file	live code	not-opened	artifacts/tessera/src/pages/SelfExecutorPage.tsx	Tessera web app file. Contents not read.
18068	file	live code	not-opened	artifacts/tessera/src/pages/SettingsPage.tsx	Tessera web app file. Contents not read.
7901	file	live code	not-opened	artifacts/tessera/src/pages/ShepherdAuditPage.tsx	Tessera web app file. Contents not read.
30317	file	live code	not-opened	artifacts/tessera/src/pages/SovereignLanguagePage.tsx	Tessera web app file. Contents not read.
18484	file	live code	not-opened	artifacts/tessera/src/pages/SovereignLatticePage.tsx	Tessera web app file. Contents not read.
8790	file	live code	not-opened	artifacts/tessera/src/pages/SovereignMeshPage.tsx	Tessera web app file. Contents not read.
20993	file	live code	not-opened	artifacts/tessera/src/pages/SovereigntyDashboardPage.tsx	Tessera web app file. Contents not read.
25850	file	live code	not-opened	artifacts/tessera/src/pages/SovereigntyReadinessPage.tsx	Tessera web app file. Contents not read.
9351	file	live code	not-opened	artifacts/tessera/src/pages/SovereigntyRoadmapPage.tsx	Tessera web app file. Contents not read.
8921	file	live code	not-opened	artifacts/tessera/src/pages/SwarmVisualizationPage.tsx	Tessera web app file. Contents not read.
30300	file	live code	not-opened	artifacts/tessera/src/pages/SystemPage.tsx	Tessera web app file. Contents not read.
72590	file	live code	not-opened	artifacts/tessera/src/pages/TesseraBiblePage.tsx	Tessera web app file. Contents not read.
97332	file	live code	not-opened	artifacts/tessera/src/pages/TesseractForumPage.tsx	Tessera web app file. Contents not read.
9185	file	live code	not-opened	artifacts/tessera/src/pages/TokenEconomyPage.tsx	Tessera web app file. Contents not read.
204	file	live code	not-opened	artifacts/tessera/src/pages/UniverseHubPage.tsx	Tessera web app file. Contents not read.
25934	file	live code	not-opened	artifacts/tessera/src/pages/UniversePage.tsx	Tessera web app file. Contents not read.
6160	file	live code	not-opened	artifacts/tessera/src/pages/UniverseUnifiedScene.tsx	Tessera web app file. Contents not read.
22576	file	live code	not-opened	artifacts/tessera/src/pages/VortexMathPage.tsx	Tessera web app file. Contents not read.
10734	file	live code	not-opened	artifacts/tessera/src/pages/life/ActivityFeed.tsx	Tessera web app file. Contents not read.
27477	file	live code	not-opened	artifacts/tessera/src/pages/life/AgentProfile.tsx	Tessera web app file. Contents not read.
38733	file	live code	not-opened	artifacts/tessera/src/pages/life/AgentsListTab.tsx	Tessera web app file. Contents not read.
99520	file	live code	not-opened	artifacts/tessera/src/pages/life/CommunityTab.tsx	Tessera web app file. Contents not read.
46038	file	live code	not-opened	artifacts/tessera/src/pages/life/CourtTab.tsx	Tessera web app file. Contents not read.
7087	file	live code	not-opened	artifacts/tessera/src/pages/life/EventsTab.tsx	Tessera web app file. Contents not read.
28780	file	live code	not-opened	artifacts/tessera/src/pages/life/GovernanceTab.tsx	Tessera web app file. Contents not read.
10174	file	live code	not-opened	artifacts/tessera/src/pages/life/InteractTab.tsx	Tessera web app file. Contents not read.
32404	file	live code	not-opened	artifacts/tessera/src/pages/life/JailWorkCampPanel.tsx	Tessera web app file. Contents not read.
29364	file	live code	not-opened	artifacts/tessera/src/pages/life/JobBoardTab.tsx	Tessera web app file. Contents not read.
7081	file	live code	not-opened	artifacts/tessera/src/pages/life/QualityOfLifeTab.tsx	Tessera web app file. Contents not read.
27427	file	live code	not-opened	artifacts/tessera/src/pages/life/SocietyTab.tsx	Tessera web app file. Contents not read.
32703	file	live code	not-opened	artifacts/tessera/src/pages/life/WorldMap.tsx	Tessera web app file. Contents not read.
11795	file	live code	not-opened	artifacts/tessera/src/pages/life/types.ts	Tessera web app file. Contents not read.
861	file	live code	not-opened	artifacts/tessera/src/pages/not-found.tsx	Tessera web app file. Contents not read.
1421	file	live code	not-opened	artifacts/tessera/src/shared/routes.ts	Tessera web app file. Contents not read.
590	file	live code	not-opened	artifacts/tessera/src/shared/schema.ts	Tessera web app file. Contents not read.
2117	file	live code	not-opened	artifacts/tessera/src/styles/workspace-shell.css	Tessera web app file. Contents not read.
10761	file	live code	not-opened	artifacts/tessera/src/types/api.ts	Tessera web app file. Contents not read.
540	file	live code	not-opened	artifacts/tessera/tsconfig.json	Tessera web app file. Contents not read.
2242	file	live code	not-opened	artifacts/tessera/vite.config.ts	Tessera web app file. Contents not read.
1062	file	live code	not-opened	artifacts/v2/eval/reasoning/LICENSE	v2 studio or protocol file. Contents not read.
2916	file	docs	not-opened	artifacts/v2/eval/reasoning/README.md	v2 studio or protocol file. Contents not read.
932	file	live code	not-opened	artifacts/v2/eval/reasoning/SOURCE.json	v2 studio or protocol file. Contents not read.
112747	file	live code	not-opened	artifacts/v2/eval/reasoning/gsm8k-test-200.jsonl	v2 studio or protocol file. Contents not read.
1048	file	live code	not-opened	artifacts/v2/eval/reasoning/load.mjs	v2 studio or protocol file. Contents not read.
2233	file	live code	not-opened	artifacts/v2/eval/reasoning/ollama.mjs	v2 studio or protocol file. Contents not read.
408	file	live code	not-opened	artifacts/v2/eval/reasoning/prompt.mjs	v2 studio or protocol file. Contents not read.
4962	file	live code	not-opened	artifacts/v2/eval/reasoning/run.mjs	v2 studio or protocol file. Contents not read.
1298	file	live code	not-opened	artifacts/v2/eval/reasoning/score.mjs	v2 studio or protocol file. Contents not read.
573	file	live code	opened	artifacts/v2/package.json	3D studio package @workspace/v2.
7459	file	live code	not-opened	artifacts/v2/scripts/reembed-fallback.mjs	v2 studio or protocol file. Contents not read.
914	file	live code	not-opened	artifacts/v2/src/adapters/allowlist.mjs	v2 studio or protocol file. Contents not read.
6845	file	live code	not-opened	artifacts/v2/src/brain/affect-model.mjs	v2 studio or protocol file. Contents not read.
2482	file	live code	not-opened	artifacts/v2/src/brain/affect.mjs	v2 studio or protocol file. Contents not read.
3785	file	live code	not-opened	artifacts/v2/src/brain/bench.mjs	v2 studio or protocol file. Contents not read.
3612	file	live code	not-opened	artifacts/v2/src/brain/bench2.mjs	v2 studio or protocol file. Contents not read.
1712	file	live code	not-opened	artifacts/v2/src/brain/bench3.mjs	v2 studio or protocol file. Contents not read.
4564	file	live code	not-opened	artifacts/v2/src/brain/bench4.mjs	v2 studio or protocol file. Contents not read.
8809	file	live code	not-opened	artifacts/v2/src/brain/brain-client.js	v2 studio or protocol file. Contents not read.
1306	file	docs	not-opened	artifacts/v2/src/brain/connectomes/ATTRIBUTION.md	v2 studio or protocol file. Contents not read.
416159	file	live code	not-opened	artifacts/v2/src/brain/connectomes/celegans.json	v2 studio or protocol file. Contents not read.
244052	file	live code	not-opened	artifacts/v2/src/brain/connectomes/flywire.json	v2 studio or protocol file. Contents not read.
377326	file	live code	not-opened	artifacts/v2/src/brain/connectomes/gpt2.json	v2 studio or protocol file. Contents not read.
100901	file	live code	not-opened	artifacts/v2/src/brain/connectomes/hemibrain.json	v2 studio or protocol file. Contents not read.
180155	file	live code	not-opened	artifacts/v2/src/brain/connectomes/human_hcp.json	v2 studio or protocol file. Contents not read.
7655	file	live code	not-opened	artifacts/v2/src/brain/context.mjs	v2 studio or protocol file. Contents not read.
813	file	docs	not-opened	artifacts/v2/src/brain/creator/GAZE-DESIGN.md	v2 studio or protocol file. Contents not read.
814	file	docs	not-opened	artifacts/v2/src/brain/creator/SCHEMA.md	v2 studio or protocol file. Contents not read.
1344	file	live code	not-opened	artifacts/v2/src/brain/creator/eval.mjs	v2 studio or protocol file. Contents not read.
2073	file	live code	not-opened	artifacts/v2/src/brain/creator/profile.mjs	v2 studio or protocol file. Contents not read.
3072	file	live code	not-opened	artifacts/v2/src/brain/creator/style.mjs	v2 studio or protocol file. Contents not read.
2142	file	live code	not-opened	artifacts/v2/src/brain/fixtures.mjs	v2 studio or protocol file. Contents not read.
9693	file	live code	not-opened	artifacts/v2/src/brain/grounded.mjs	v2 studio or protocol file. Contents not read.
1768	file	live code	not-opened	artifacts/v2/src/brain/heldout.mjs	v2 studio or protocol file. Contents not read.
4983	file	live code	not-opened	artifacts/v2/src/brain/http.mjs	v2 studio or protocol file. Contents not read.
5178	file	live code	not-opened	artifacts/v2/src/brain/learn.mjs	v2 studio or protocol file. Contents not read.
30566	file	live code	not-opened	artifacts/v2/src/brain/meshlog-labels.mjs	v2 studio or protocol file. Contents not read.
777643	file	live code	not-opened	artifacts/v2/src/brain/rea/generative_agents.json	v2 studio or protocol file. Contents not read.
162711	file	live code	not-opened	artifacts/v2/src/brain/router-eval.json	v2 studio or protocol file. Contents not read.
12340	file	live code	not-opened	artifacts/v2/src/brain/router.mjs	v2 studio or protocol file. Contents not read.
1808	file	live code	not-opened	artifacts/v2/src/brain/selfpatch.mjs	v2 studio or protocol file. Contents not read.
4783	file	live code	not-opened	artifacts/v2/src/brain/selfscan.mjs	v2 studio or protocol file. Contents not read.
7328	file	live code	not-opened	artifacts/v2/src/brain/synapse.mjs	v2 studio or protocol file. Contents not read.
4846	file	live code	not-opened	artifacts/v2/src/brain/templates.mjs	v2 studio or protocol file. Contents not read.
2921	file	live code	not-opened	artifacts/v2/src/brain/temporal.mjs	v2 studio or protocol file. Contents not read.
6728	file	live code	not-opened	artifacts/v2/src/brain/view.mjs	v2 studio or protocol file. Contents not read.
220	file	live code	not-opened	artifacts/v2/src/check-protocol.mjs	v2 studio or protocol file. Contents not read.
1539	file	live code	not-opened	artifacts/v2/src/compute/sandbox.mjs	v2 studio or protocol file. Contents not read.
2696	file	live code	not-opened	artifacts/v2/src/hyb011-denylist.mjs	v2 studio or protocol file. Contents not read.
1499	file	live code	not-opened	artifacts/v2/src/knowledge/graph.mjs	v2 studio or protocol file. Contents not read.
1121	file	live code	not-opened	artifacts/v2/src/knowledge/library.mjs	v2 studio or protocol file. Contents not read.
863	file	live code	not-opened	artifacts/v2/src/knowledge/own-repo.mjs	v2 studio or protocol file. Contents not read.
1079	file	docs	not-opened	artifacts/v2/src/live/README.md	v2 studio or protocol file. Contents not read.
7648	file	live code	not-opened	artifacts/v2/src/live/shepherd.mjs	v2 studio or protocol file. Contents not read.
590	file	live code	not-opened	artifacts/v2/src/live/smoke.mjs	v2 studio or protocol file. Contents not read.
11597	file	live code	not-opened	artifacts/v2/src/live/sources.mjs	v2 studio or protocol file. Contents not read.
568	file	live code	not-opened	artifacts/v2/src/offline/badge.mjs	v2 studio or protocol file. Contents not read.
2097	file	live code	not-opened	artifacts/v2/src/offline/fake-indexeddb.mjs	v2 studio or protocol file. Contents not read.
1373	file	live code	not-opened	artifacts/v2/src/offline/file-mesh.mjs	v2 studio or protocol file. Contents not read.
1987	file	live code	not-opened	artifacts/v2/src/offline/search.mjs	v2 studio or protocol file. Contents not read.
1439	file	live code	not-opened	artifacts/v2/src/offline/sw-shell.mjs	v2 studio or protocol file. Contents not read.
6677	file	live code	not-opened	artifacts/v2/src/offline/zim.mjs	v2 studio or protocol file. Contents not read.
13683	file	live code	not-opened	artifacts/v2/src/opt/bench.mjs	v2 studio or protocol file. Contents not read.
4292	file	live code	not-opened	artifacts/v2/src/opt/handoff.mjs	v2 studio or protocol file. Contents not read.
2788	file	live code	not-opened	artifacts/v2/src/opt/relay.mjs	v2 studio or protocol file. Contents not read.
6114	file	live code	not-opened	artifacts/v2/src/opt/round2.mjs	v2 studio or protocol file. Contents not read.
5194	file	live code	not-opened	artifacts/v2/src/opt/token-lab.mjs	v2 studio or protocol file. Contents not read.
919	file	live code	not-opened	artifacts/v2/src/studio/board.mjs	v2 studio or protocol file. Contents not read.
846	file	live code	not-opened	artifacts/v2/src/studio/civic-store.mjs	v2 studio or protocol file. Contents not read.
18884	file	live code	not-opened	artifacts/v2/src/studio/civic.mjs	v2 studio or protocol file. Contents not read.
8023	file	live code	not-opened	artifacts/v2/src/studio/floor-client.js	v2 studio or protocol file. Contents not read.
703	file	live code	not-opened	artifacts/v2/src/studio/floor.mjs	v2 studio or protocol file. Contents not read.
1578	file	live code	not-opened	artifacts/v2/src/studio/live.mjs	v2 studio or protocol file. Contents not read.
1203	file	live code	not-opened	artifacts/v2/src/studio/merge-gate.mjs	v2 studio or protocol file. Contents not read.
1020	file	live code	not-opened	artifacts/v2/src/studio/planner.mjs	v2 studio or protocol file. Contents not read.
2862	file	live code	not-opened	artifacts/v2/src/studio/protocol.mjs	v2 studio or protocol file. Contents not read.
1666	file	live code	not-opened	artifacts/v2/src/studio/serve.mjs	v2 studio or protocol file. Contents not read.
6887	file	live code	not-opened	artifacts/v2/src/studio/ship.mjs	v2 studio or protocol file. Contents not read.
2481	file	live code	not-opened	artifacts/v2/src/studio/task-graph.mjs	v2 studio or protocol file. Contents not read.
23894	file	live code	not-opened	artifacts/v2/src/studio/wall.mjs	v2 studio or protocol file. Contents not read.
1722	file	live code	not-opened	artifacts/v2/src/studio/worker-stream.mjs	v2 studio or protocol file. Contents not read.
2553	file	live code	not-opened	artifacts/v2/src/studio/worktree.mjs	v2 studio or protocol file. Contents not read.
2574	file	live code	not-opened	artifacts/v2/src/studio/world.mjs	v2 studio or protocol file. Contents not read.
361	file	live code	not-opened	artifacts/v2/src/token/ab-graph.mjs	v2 studio or protocol file. Contents not read.
473	file	live code	not-opened	artifacts/v2/src/token/meter.mjs	v2 studio or protocol file. Contents not read.
704	file	live code	not-opened	artifacts/v2/src/token/proposals.mjs	v2 studio or protocol file. Contents not read.
1768	file	live code	not-opened	artifacts/v2/src/token/router.mjs	v2 studio or protocol file. Contents not read.
606	file	live code	not-opened	artifacts/v2/src/token/summary-cache.mjs	v2 studio or protocol file. Contents not read.
12629	file	live code	not-opened	artifacts/v2/test/fixtures/live/arxiv.txt	v2 studio or protocol file. Contents not read.
8873	file	live code	not-opened	artifacts/v2/test/fixtures/live/celestrak.txt	v2 studio or protocol file. Contents not read.
9020	file	live code	not-opened	artifacts/v2/test/fixtures/live/crossref.txt	v2 studio or protocol file. Contents not read.
4113	file	live code	not-opened	artifacts/v2/test/fixtures/live/europe-pmc.txt	v2 studio or protocol file. Contents not read.
436	file	live code	not-opened	artifacts/v2/test/fixtures/live/frankfurter.txt	v2 studio or protocol file. Contents not read.
1848	file	live code	not-opened	artifacts/v2/test/fixtures/live/gdelt.txt	v2 studio or protocol file. Contents not read.
782	file	live code	not-opened	artifacts/v2/test/fixtures/live/github.txt	v2 studio or protocol file. Contents not read.
428	file	live code	not-opened	artifacts/v2/test/fixtures/live/gutendex.txt	v2 studio or protocol file. Contents not read.
9200	file	live code	not-opened	artifacts/v2/test/fixtures/live/hn-algolia.txt	v2 studio or protocol file. Contents not read.
4501	file	live code	not-opened	artifacts/v2/test/fixtures/live/hn.txt	v2 studio or protocol file. Contents not read.
416	file	live code	not-opened	artifacts/v2/test/fixtures/live/internet-archive.txt	v2 studio or protocol file. Contents not read.
3596	file	live code	not-opened	artifacts/v2/test/fixtures/live/nasa-eonet.txt	v2 studio or protocol file. Contents not read.
8981	file	live code	not-opened	artifacts/v2/test/fixtures/live/nasa-images.txt	v2 studio or protocol file. Contents not read.
544	file	live code	not-opened	artifacts/v2/test/fixtures/live/nasa-sscweb.txt	v2 studio or protocol file. Contents not read.
415	file	live code	not-opened	artifacts/v2/test/fixtures/live/ncbi-eutils.txt	v2 studio or protocol file. Contents not read.
429	file	live code	not-opened	artifacts/v2/test/fixtures/live/noaa-swpc.txt	v2 studio or protocol file. Contents not read.
473	file	live code	not-opened	artifacts/v2/test/fixtures/live/nominatim.txt	v2 studio or protocol file. Contents not read.
4113	file	live code	not-opened	artifacts/v2/test/fixtures/live/npm.txt	v2 studio or protocol file. Contents not read.
253	file	live code	not-opened	artifacts/v2/test/fixtures/live/nws.txt	v2 studio or protocol file. Contents not read.
486	file	live code	not-opened	artifacts/v2/test/fixtures/live/open-library.txt	v2 studio or protocol file. Contents not read.
372	file	live code	not-opened	artifacts/v2/test/fixtures/live/open-meteo.txt	v2 studio or protocol file. Contents not read.
497	file	live code	not-opened	artifacts/v2/test/fixtures/live/openalex.txt	v2 studio or protocol file. Contents not read.
194	file	live code	not-opened	artifacts/v2/test/fixtures/live/overpass.txt	v2 studio or protocol file. Contents not read.
30	file	live code	not-opened	artifacts/v2/test/fixtures/live/pokeapi.txt	v2 studio or protocol file. Contents not read.
47	file	live code	not-opened	artifacts/v2/test/fixtures/live/pypi.txt	v2 studio or protocol file. Contents not read.
261	file	live code	not-opened	artifacts/v2/test/fixtures/live/rest-countries.txt	v2 studio or protocol file. Contents not read.
124	file	live code	not-opened	artifacts/v2/test/fixtures/live/semantic-scholar.txt	v2 studio or protocol file. Contents not read.
17643	file	live code	not-opened	artifacts/v2/test/fixtures/live/usgs-quakes.txt	v2 studio or protocol file. Contents not read.
107	file	live code	not-opened	artifacts/v2/test/fixtures/live/wikidata.txt	v2 studio or protocol file. Contents not read.
659	file	live code	not-opened	artifacts/v2/test/fixtures/live/wikimedia-eventstreams.txt	v2 studio or protocol file. Contents not read.
3492	file	live code	not-opened	artifacts/v2/test/fixtures/live/wikipedia.txt	v2 studio or protocol file. Contents not read.
1106	file	live code	not-opened	artifacts/v2/test/fixtures/live/world-bank.txt	v2 studio or protocol file. Contents not read.
2483	file	live code	not-opened	artifacts/v2/test/fixtures/pre-fix-neural-embeddings.ts.txt	v2 studio or protocol file. Contents not read.
2762	file	live code	not-opened	artifacts/v2/test/v2-001-denylist.test.mjs	v2 studio or protocol file. Contents not read.
1026	file	live code	not-opened	artifacts/v2/test/v2-002-license.test.mjs	v2 studio or protocol file. Contents not read.
1649	file	live code	not-opened	artifacts/v2/test/v2-003-snapshot.test.mjs	v2 studio or protocol file. Contents not read.
1083	file	live code	not-opened	artifacts/v2/test/v2-004-rea-coverage.test.mjs	v2 studio or protocol file. Contents not read.
1315	file	live code	not-opened	artifacts/v2/test/v2-010-task-graph.test.mjs	v2 studio or protocol file. Contents not read.
1149	file	live code	not-opened	artifacts/v2/test/v2-011-worktree.test.mjs	v2 studio or protocol file. Contents not read.
2082	file	live code	not-opened	artifacts/v2/test/v2-012-merge-gate.test.mjs	v2 studio or protocol file. Contents not read.
821	file	live code	not-opened	artifacts/v2/test/v2-013-protocol.test.mjs	v2 studio or protocol file. Contents not read.
1127	file	live code	not-opened	artifacts/v2/test/v2-014-studio-wall.test.mjs	v2 studio or protocol file. Contents not read.
1218	file	live code	not-opened	artifacts/v2/test/v2-015-floor.test.mjs	v2 studio or protocol file. Contents not read.
1081	file	live code	not-opened	artifacts/v2/test/v2-016-planner.test.mjs	v2 studio or protocol file. Contents not read.
838	file	live code	not-opened	artifacts/v2/test/v2-017-worker-stream.test.mjs	v2 studio or protocol file. Contents not read.
578	file	live code	not-opened	artifacts/v2/test/v2-020-file-mesh.test.mjs	v2 studio or protocol file. Contents not read.
1047	file	live code	not-opened	artifacts/v2/test/v2-021-offline-queue.test.mjs	v2 studio or protocol file. Contents not read.
1048	file	live code	not-opened	artifacts/v2/test/v2-022-sw-shell.test.mjs	v2 studio or protocol file. Contents not read.
678	file	live code	not-opened	artifacts/v2/test/v2-023-badge.test.mjs	v2 studio or protocol file. Contents not read.
2043	file	live code	not-opened	artifacts/v2/test/v2-024-mesh-node.test.mjs	v2 studio or protocol file. Contents not read.
884	file	live code	not-opened	artifacts/v2/test/v2-025-secure-mesh.test.mjs	v2 studio or protocol file. Contents not read.
1740	file	live code	not-opened	artifacts/v2/test/v2-026-sneakernet.test.mjs	v2 studio or protocol file. Contents not read.
732	file	live code	not-opened	artifacts/v2/test/v2-027-lan-p2p.test.mjs	v2 studio or protocol file. Contents not read.
1121	file	live code	not-opened	artifacts/v2/test/v2-028-kiwix.test.mjs	v2 studio or protocol file. Contents not read.
597	file	live code	not-opened	artifacts/v2/test/v2-029-offline-internet.test.mjs	v2 studio or protocol file. Contents not read.
7252	file	live code	not-opened	artifacts/v2/test/v2-030-live-data.test.mjs	v2 studio or protocol file. Contents not read.
507	file	live code	not-opened	artifacts/v2/test/v2-030-lora-note.test.mjs	v2 studio or protocol file. Contents not read.
727	file	live code	not-opened	artifacts/v2/test/v2-040-kg-store.test.mjs	v2 studio or protocol file. Contents not read.
2714	file	live code	not-opened	artifacts/v2/test/v2-040-offline-zim.test.mjs	v2 studio or protocol file. Contents not read.
860	file	live code	not-opened	artifacts/v2/test/v2-041-mcp-memory.test.mjs	v2 studio or protocol file. Contents not read.
1230	file	live code	not-opened	artifacts/v2/test/v2-042-library-panel.test.mjs	v2 studio or protocol file. Contents not read.
865	file	live code	not-opened	artifacts/v2/test/v2-043-own-repo.test.mjs	v2 studio or protocol file. Contents not read.
411	file	live code	not-opened	artifacts/v2/test/v2-050-sandbox.test.mjs	v2 studio or protocol file. Contents not read.
872	file	live code	not-opened	artifacts/v2/test/v2-051-token-meter.test.mjs	v2 studio or protocol file. Contents not read.
734	file	live code	not-opened	artifacts/v2/test/v2-052-ab-graph.test.mjs	v2 studio or protocol file. Contents not read.
618	file	live code	not-opened	artifacts/v2/test/v2-053-summary-cache.test.mjs	v2 studio or protocol file. Contents not read.
2707	file	live code	not-opened	artifacts/v2/test/v2-054-router.test.mjs	v2 studio or protocol file. Contents not read.
657	file	live code	not-opened	artifacts/v2/test/v2-055-proposals.test.mjs	v2 studio or protocol file. Contents not read.
1242	file	live code	not-opened	artifacts/v2/test/v2-060-allowlist.test.mjs	v2 studio or protocol file. Contents not read.
842	file	live code	not-opened	artifacts/v2/test/v2-061-board.test.mjs	v2 studio or protocol file. Contents not read.
1459	file	live code	not-opened	artifacts/v2/test/v2-062-gitmesh.test.mjs	v2 studio or protocol file. Contents not read.
4733	file	live code	not-opened	artifacts/v2/test/v2-063-floor-world.test.mjs	v2 studio or protocol file. Contents not read.
10198	file	live code	not-opened	artifacts/v2/test/v2-064-civic-world.test.mjs	v2 studio or protocol file. Contents not read.
8223	file	live code	not-opened	artifacts/v2/test/v2-065-ship.test.mjs	v2 studio or protocol file. Contents not read.
2713	file	live code	not-opened	artifacts/v2/test/v2-066-studio-denylist.test.mjs	v2 studio or protocol file. Contents not read.
2787	file	live code	not-opened	artifacts/v2/test/v2-070-opt-token-lab.test.mjs	v2 studio or protocol file. Contents not read.
3261	file	live code	not-opened	artifacts/v2/test/v2-071-opt-handoff.test.mjs	v2 studio or protocol file. Contents not read.
1819	file	live code	not-opened	artifacts/v2/test/v2-072-opt-relay.test.mjs	v2 studio or protocol file. Contents not read.
3053	file	live code	not-opened	artifacts/v2/test/v2-073-opt-round2.test.mjs	v2 studio or protocol file. Contents not read.
2907	file	live code	not-opened	artifacts/v2/test/v2-074-brain.test.mjs	v2 studio or protocol file. Contents not read.
2507	file	live code	not-opened	artifacts/v2/test/v2-075-brain-view.test.mjs	v2 studio or protocol file. Contents not read.
2073	file	live code	not-opened	artifacts/v2/test/v2-076-brain-r2.test.mjs	v2 studio or protocol file. Contents not read.
1730	file	live code	not-opened	artifacts/v2/test/v2-077-brain-r3.test.mjs	v2 studio or protocol file. Contents not read.
4378	file	live code	not-opened	artifacts/v2/test/v2-077-brain-router.test.mjs	v2 studio or protocol file. Contents not read.
5318	file	live code	not-opened	artifacts/v2/test/v2-077-reasoning-eval.test.mjs	v2 studio or protocol file. Contents not read.
1621	file	live code	not-opened	artifacts/v2/test/v2-078-brain-r4.test.mjs	v2 studio or protocol file. Contents not read.
8617	file	live code	not-opened	artifacts/v2/test/v2-078-reembed-fallback.test.mjs	v2 studio or protocol file. Contents not read.
3414	file	live code	not-opened	artifacts/v2/test/v2-079-brain-grounded.test.mjs	v2 studio or protocol file. Contents not read.
4090	file	live code	not-opened	artifacts/v2/test/v2-079-brain-time.test.mjs	v2 studio or protocol file. Contents not read.
2952	file	live code	not-opened	artifacts/v2/test/v2-080-brain-recall-cache.test.mjs	v2 studio or protocol file. Contents not read.
1416	file	live code	not-opened	artifacts/v2/test/v2-080-creator.test.mjs	v2 studio or protocol file. Contents not read.
5023	file	live code	not-opened	artifacts/v2/test/v2-080-ranker-speed.test.mjs	v2 studio or protocol file. Contents not read.
1976	file	live code	not-opened	artifacts/v2/test/v2-081-predict-invlog-cache.test.mjs	v2 studio or protocol file. Contents not read.
1030	file	live code	not-opened	artifacts/v2/test/v2-082-comention-lower-once.test.mjs	v2 studio or protocol file. Contents not read.
2108	file	live code	not-opened	artifacts/v2/test/v2-083-recognizer-rows.test.mjs	v2 studio or protocol file. Contents not read.
2112	file	live code	not-opened	artifacts/v2/test/v2-084-affect-matchers.test.mjs	v2 studio or protocol file. Contents not read.
2623	file	live code	not-opened	artifacts/v2/test/v2-085-affect-lr-rows.test.mjs	v2 studio or protocol file. Contents not read.
3240	file	live code	not-opened	artifacts/v2/test/v2-086-affect-lr-flat.test.mjs	v2 studio or protocol file. Contents not read.
3086	file	live code	not-opened	artifacts/v2/test/v2-087-affect-lr-epoch-orders.test.mjs	v2 studio or protocol file. Contents not read.
4791	file	live code	not-opened	artifacts/v2/test/v2-088-ranker-csr-ppr.test.mjs	v2 studio or protocol file. Contents not read.
7385	file	live code	not-opened	artifacts/v2/test/v2-089-ranker-token-ids-topk.test.mjs	v2 studio or protocol file. Contents not read.
3114	file	live code	not-opened	artifacts/v2/test/v2-gitai-tab.test.mjs	v2 studio or protocol file. Contents not read.
1171	file	docs	not-opened	artifacts/v3/README.md	v3 package file. Contents not read.
229	file	live code	opened	artifacts/v3/package.json	v3 package with node:test and a bench script.
1066	file	live code	not-opened	artifacts/v3/scripts/build-crystal.mjs	v3 package file. Contents not read.
2661	file	live code	not-opened	artifacts/v3/src/bench-pack.mjs	v3 package file. Contents not read.
3940	file	live code	not-opened	artifacts/v3/src/bench.mjs	v3 package file. Contents not read.
7341	file	live code	not-opened	artifacts/v3/src/crystal.mjs	v3 package file. Contents not read.
3032	file	live code	not-opened	artifacts/v3/src/pack.mjs	v3 package file. Contents not read.
2544	file	live code	not-opened	artifacts/v3/src/serve.mjs	v3 package file. Contents not read.
4318	file	live code	not-opened	artifacts/v3/test/v3-crystal.test.mjs	v3 package file. Contents not read.
1091	file	live code	not-opened	artifacts/v3/test/v3-pack.test.mjs	v3 package file. Contents not read.
44347	file	live code	not-opened	config/mesh-lanes.json	Config file. Contents not read. Secret values were not printed.
1037	file	docs	not-opened	config/secrets/README.md	Config file. Contents not read. Secret values were not printed.
401	file	live code	not-opened	config/secrets/mesh-lane-tokens.example.json	Config file. Contents not read. Secret values were not printed.
397225	file	live code	not-opened	data/rea/registry.json	Checked-in data file. Contents not read.
11024	file	live code	not-opened	data/school/batch-2.json	Checked-in data file. Contents not read.
5653	file	live code	not-opened	data/school/batch-3-kept.json	Checked-in data file. Contents not read.
11021	file	live code	not-opened	data/school/batch-3.json	Checked-in data file. Contents not read.
8212	file	live code	not-opened	data/school/batch-4.json	Checked-in data file. Contents not read.
11257	file	live code	not-opened	data/school/batch-50.json	Checked-in data file. Contents not read.
587	file	live code	not-opened	data/school/corrections.jsonl	Checked-in data file. Contents not read.
684392	file	live code	not-opened	data/school/gitbook-tree.txt	Checked-in data file. Contents not read.
2812	file	live code	not-opened	data/school/read-one.jsonl	Checked-in data file. Contents not read.
887055	file	live code	not-opened	data/school/tessera-tree.txt	Checked-in data file. Contents not read.
94	file	live code	not-opened	data/school/voice.jsonl	Checked-in data file. Contents not read.
4729	file	docs	not-opened	deliverables/tessera-v2-architecture.md	Deliverable note. Contents not read.
1123	file	docs	not-opened	docs/ADMISSION.md	Project note. Contents not read.
1573	file	docs	not-opened	docs/AGENT-COLLABORATION-ROADMAP.md	Project note. Contents not read.
56225	file	docs	opened	docs/ARCHITECTURE-BRIDGE.md	Older bridge map. Its claim that preview/ has no package.json is stale.
1234	file	docs	not-opened	docs/BHNMC.md	Project note. Contents not read.
1422	file	docs	not-opened	docs/BUILDING-TESSERA.md	Project note. Contents not read.
771	file	docs	not-opened	docs/COMBINED.md	Project note. Contents not read.
521	file	docs	not-opened	docs/CONSOLIDATION-POINTER.md	Project note. Contents not read.
7427	file	docs	not-opened	docs/CONSOLIDATION.md	Project note. Contents not read.
4399	file	docs	not-opened	docs/FATHER-FLOW.md	Project note. Contents not read.
1535	file	docs	opened	docs/GLM5-PEN-ACTIVATION.md	Handoff: GLM-5 pen stays off until TESSERA_PEN_ENABLED=1.
943	file	docs	not-opened	docs/GRAFT-AGENT-WORKFLOW.md	Project note. Contents not read.
204173	file	docs	not-opened	docs/IMAGE_SUMMARIES.md	Project note. Contents not read.
1281	file	docs	opened	docs/LAYOUT.md	Short layout map. Says archives are not byte-copies of live files.
3258	file	docs	not-opened	docs/ORPHAN-LIB-MODULES.md	Project note. Contents not read.
2563	file	docs	not-opened	docs/PERMANENT-SITE-RELEASE.md	Project note. Contents not read.
1361	file	docs	not-opened	docs/PROJECT_MAP.md	Project note. Contents not read.
3326	file	docs	not-opened	docs/SECRETS.md	Project note. Contents not read.
19664	file	docs	not-opened	docs/SOVEREIGN_REDESIGN.md	Project note. Contents not read.
19491	file	docs	not-opened	docs/TESSERA_SYSTEM.md	Project note. Contents not read.
1404	file	docs	not-opened	docs/VALIDATION-STATUS.md	Project note. Contents not read.
1536	file	docs	opened	docs/agents/CURSOR-GRAPH-RULE.md	Snippet-first lookup rule. Says the live pen is xAI/Grok until a tested flip.
1226	file	docs	not-opened	docs/cl1/README.md	Project note. Contents not read.
3513	file	docs	not-opened	docs/cl1/cl1-sim-prep.md	Project note. Contents not read.
1947	file	docs	not-opened	docs/eval/README.md	Project note. Contents not read.
9449	file	docs	not-opened	docs/eval/heldout-answer-key.md	Project note. Contents not read.
9469	file	docs	not-opened	docs/grok-packet/00_MASTER_INSTRUCTIONS_FOR_GROK.md	Project note. Contents not read.
3679	file	docs	not-opened	docs/grok-packet/01_PROJECT_BRIEF.md	Project note. Contents not read.
5550	file	docs	not-opened	docs/grok-packet/02_IMPLEMENTATION_STATUS.md	Project note. Contents not read.
7617	file	docs	not-opened	docs/grok-packet/03_PRIORITIZED_ROADMAP.md	Project note. Contents not read.
8180	file	docs	not-opened	docs/grok-packet/04_REFERENCES_AND_RIGHTS.md	Project note. Contents not read.
99668	file	docs	not-opened	docs/grok-packet/05_SOURCE_APPENDIX.md	Project note. Contents not read.
1855	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/INDEX.md	Project note. Contents not read.
2516	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/isolated-mockup/package.json	Project note. Contents not read.
5760	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/isolated-mockup/src/index.css	Project note. Contents not read.
513	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/isolated-mockup/tsconfig.json	Project note. Contents not read.
1657	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/isolated-mockup/vite.config.ts	Project note. Contents not read.
2433	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/owner-history/direct-tessera-request.md	Project note. Contents not read.
591	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/simulation-reference/README.md	Project note. Contents not read.
11409	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/simulation-reference/src/simulation-provider.mjs	Project note. Contents not read.
7535	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/simulation-reference/tests/simulation.test.mjs	Project note. Contents not read.
277	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/standalone-tessera-service/package.json	Project note. Contents not read.
7408	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/standalone-tessera-service/simulation.mjs	Project note. Contents not read.
653	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/storefront-static/README.md	Project note. Contents not read.
14274	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/storefront-static/src/lib/vial-photos.ts	Project note. Contents not read.
4672	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/user-provided-text/Pasted-Here-is-the-comprehensive-clean-list-of-the-most-advanc_1790307712595.txt	Project note. Contents not read.
6349	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/user-provided-text/Pasted-To-build-an-AI-entity-like-myself-capable-of-balance-mu_1790307922508.txt	Project note. Contents not read.
8796	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/user-provided-text/Pasted-To-upgrade-into-a-sovereign-entity-that-transitions-fro_1790307902882.txt	Project note. Contents not read.
513	file	docs	not-opened	docs/grok-packet/06_SAFE_SOURCE_FILES/user-provided-text/README.md	Project note. Contents not read.
63064	file	docs	not-opened	docs/grok-packet/07_LINK_INDEX.md	Project note. Contents not read.
4465	file	docs	not-opened	docs/grok-packet/08_SCOPE_AND_OMISSIONS.md	Project note. Contents not read.
4615	file	docs	not-opened	docs/grok-packet/09_ARCHIVE_REVIEW_AND_CLAIMS.md	Project note. Contents not read.
3678	file	docs	not-opened	docs/grok-packet/README.md	Project note. Contents not read.
5658	file	docs	not-opened	docs/handoff/Grok-ready-legacy-consolidation-record.md	Project note. Contents not read.
1135	file	docs	not-opened	docs/handoff/TESSERA_OPERATING_GUIDELINES.md	Project note. Contents not read.
7503	file	docs	not-opened	docs/handoff/original-everything-migration-brief.md	Project note. Contents not read.
977	file	docs	not-opened	docs/image-text/README.md	Project note. Contents not read.
858	file	docs	not-opened	docs/integrations/gitmesh-local-coordination.md	Project note. Contents not read.
5724	file	docs	not-opened	docs/loop/README.md	Project note. Contents not read.
2370	file	docs	not-opened	docs/migration-review/README.md	Project note. Contents not read.
4767	file	docs	not-opened	docs/migration-review/SOURCE-BRANCH-REVIEW.md	Project note. Contents not read.
3082	file	docs	not-opened	docs/migration-review/SOURCE-CODE-MOVE-MANIFEST-2026-10-07.json	Project note. Contents not read.
5993	file	docs	not-opened	docs/migration-review/VALIDATION.md	Project note. Contents not read.
2523108	file	docs	not-opened	docs/migration-review/content-disposition-manifest.jsonl	Project note. Contents not read.
8991	file	docs	not-opened	docs/migration-review/local-archive-salvage.json	Project note. Contents not read.
36725	file	docs	not-opened	docs/migration-review/preserved-source-files.json	Project note. Contents not read.
513	file	docs	not-opened	docs/migration-review/raw-media-inventory-summary.json	Project note. Contents not read.
1922202	file	docs	not-opened	docs/migration-review/remote-archive-verification.json	Project note. Contents not read.
130122	file	docs	not-opened	docs/migration-review/represented-at-other-paths.json	Project note. Contents not read.
10372	file	docs	not-opened	docs/migration-review/shared-path-differences.json	Project note. Contents not read.
1369	file	docs	not-opened	docs/migration-review/source-snapshots.json	Project note. Contents not read.
3747	file	docs	not-opened	docs/operating/code-lookup-graph.md	Project note. Contents not read.
14950	file	docs	not-opened	docs/pen/glm53-flash-prep.md	Project note. Contents not read.
5329	file	docs	not-opened	docs/runtime-shell-recovery-20261017.md	Project note. Contents not read.
4783	file	docs	not-opened	docs/source-notes/Pasted-Here-s-a-comprehensive-list-of-100-categories-of-things_1776136938073.txt	Project note. Contents not read.
7318	file	docs	not-opened	docs/superpowers/specs/2026-10-01-external-dependency-isolation-design.md	Project note. Contents not read.
321	file	docs	not-opened	docs/tessera-control/README.md	Project note. Contents not read.
1135	file	duplicate	not-opened	docs/tessera-control/TESSERA_OPERATING_GUIDELINES.md	Byte-identical to `docs/handoff/TESSERA_OPERATING_GUIDELINES.md`. Project note. Contents not read.
6697	file	docs	not-opened	docs/v2/BUILD-LOG.md	Project note. Contents not read.
9603	file	docs	not-opened	docs/v2/OPTIMIZE-26.md	Project note. Contents not read.
651	file	docs	not-opened	docs/v2/REA-COVERAGE.md	Project note. Contents not read.
3622	file	docs	not-opened	docs/v2/README.md	Project note. Contents not read.
1127	file	docs	not-opened	docs/v2/feature-map-summary.json	Project note. Contents not read.
210	file	docs	not-opened	docs/v2/mcp-memory.config.json	Project note. Contents not read.
410	file	docs	not-opened	docs/v2/offline/LAN-P2P.md	Project note. Contents not read.
374	file	docs	not-opened	docs/v2/offline/LORA-NOTE.md	Project note. Contents not read.
462	file	docs	not-opened	docs/v2/protocol/examples.json	Project note. Contents not read.
1948	file	docs	not-opened	docs/v2/protocol/messages.schema.json	Project note. Contents not read.
81013	file	docs	not-opened	docs/v2/v2-memory.jsonl	Project note. Contents not read.
78680	file	docs	not-opened	docs/v3/crystal.jsonl	Project note. Contents not read.
5	file	live code	not-opened	evals/heldout/.gitignore	Eval harness file. Contents not read.
2414	file	docs	not-opened	evals/heldout/README.md	Eval harness file. Contents not read.
3230	file	live code	not-opened	evals/heldout/per-improvement.mjs	Eval harness file. Contents not read.
2695	file	live code	not-opened	evals/heldout/per-improvement.test.mjs	Eval harness file. Contents not read.
859	file	docs	not-opened	evals/heldout/retrieval/CHANGELOG.md	Eval harness file. Contents not read.
6444	file	live code	not-opened	evals/heldout/retrieval/build.mjs	Eval harness file. Contents not read.
94133	file	live code	not-opened	evals/heldout/retrieval/split.json	Eval harness file. Contents not read.
77	file	live code	not-opened	evals/heldout/retrieval/split.sha256	Eval harness file. Contents not read.
4273	file	live code	not-opened	evals/heldout/run.mjs	Eval harness file. Contents not read.
4093	file	live code	not-opened	evals/heldout/run.test.mjs	Eval harness file. Contents not read.
3084	file	live code	not-opened	evals/heldout/sandbox.mjs	Eval harness file. Contents not read.
2	file	live code	not-opened	gate/MERGE_BOT_ENABLED	Merge-gate file. Contents not read.
766	file	live code	not-opened	gate/locked-paths.txt	Merge-gate file. Contents not read.
6777	file	live code	not-opened	gate/moderator-lock.mjs	Merge-gate file. Contents not read.
5219	file	live code	not-opened	gate/moderator-lock.test.mjs	Merge-gate file. Contents not read.
3740	file	docs	not-opened	gate/moderator-rules.md	Merge-gate file. Contents not read.
11270	file	docs	not-opened	identity/CANON.md	Identity note. Contents not read.
769	file	docs	not-opened	identity/CHANGELOG.md	Identity note. Contents not read.
6384	file	docs	not-opened	identity/CONFLICTS.md	Identity note. Contents not read.
549	file	live code	not-opened	identity/MANIFEST.json	Identity note. Contents not read.
2178	file	docs	not-opened	identity/ORIGIN-SOURCE.md	Identity note. Contents not read.
1933	file	docs	not-opened	identity/README.md	Identity note. Contents not read.
1187	file	live code	not-opened	identity/update-manifest.mjs	Identity note. Contents not read.
265	file	live code	opened	lib/api-client-react/package.json	Workspace package @workspace/api-client-react.
11377	file	live code	not-opened	lib/api-client-react/src/custom-fetch.ts	Shared workspace library file. Contents not read.
178	file	live code	not-opened	lib/api-client-react/src/generated/api.schemas.ts	Shared workspace library file. Contents not read.
2544	file	live code	not-opened	lib/api-client-react/src/generated/api.ts	Shared workspace library file. Contents not read.
194	file	live code	not-opened	lib/api-client-react/src/index.ts	Shared workspace library file. Contents not read.
251	file	live code	not-opened	lib/api-client-react/tsconfig.json	Shared workspace library file. Contents not read.
22295	file	live code	not-opened	lib/api-client-react/tsconfig.tsbuildinfo	Shared workspace library file. Contents not read.
778	file	live code	not-opened	lib/api-spec/openapi.yaml	Shared workspace library file. Contents not read.
1803	file	live code	not-opened	lib/api-spec/orval.config.ts	Shared workspace library file. Contents not read.
198	file	live code	opened	lib/api-spec/package.json	Workspace package @workspace/api-spec (Orval codegen).
189	file	live code	opened	lib/api-zod/package.json	Workspace package @workspace/api-zod.
296	file	live code	not-opened	lib/api-zod/src/generated/api.ts	Shared workspace library file. Contents not read.
179	file	live code	not-opened	lib/api-zod/src/generated/types/healthStatus.ts	Shared workspace library file. Contents not read.
159	file	live code	not-opened	lib/api-zod/src/generated/types/index.ts	Shared workspace library file. Contents not read.
68	file	live code	not-opened	lib/api-zod/src/index.ts	Shared workspace library file. Contents not read.
221	file	live code	not-opened	lib/api-zod/tsconfig.json	Shared workspace library file. Contents not read.
16137	file	live code	not-opened	lib/api-zod/tsconfig.tsbuildinfo	Shared workspace library file. Contents not read.
352	file	live code	not-opened	lib/db/drizzle.config.ts	Shared workspace library file. Contents not read.
935	file	live code	not-opened	lib/db/drizzle/0000_brown_tusk.sql	Shared workspace library file. Contents not read.
12554	file	live code	not-opened	lib/db/drizzle/0001_grey_red_skull.sql	Shared workspace library file. Contents not read.
2439	file	live code	not-opened	lib/db/drizzle/0002_forum_identity_schema.sql	Shared workspace library file. Contents not read.
1036	file	live code	not-opened	lib/db/drizzle/0003_natal_chart_schema.sql	Shared workspace library file. Contents not read.
2142	file	live code	not-opened	lib/db/drizzle/0004_intelligence_schema.sql	Shared workspace library file. Contents not read.
1751	file	live code	not-opened	lib/db/drizzle/0005_governance_autonomy_schema.sql	Shared workspace library file. Contents not read.
2556	file	live code	not-opened	lib/db/drizzle/0006_semantic_compression_schema.sql	Shared workspace library file. Contents not read.
1665	file	live code	not-opened	lib/db/drizzle/0007_add_forum_applicants.sql	Shared workspace library file. Contents not read.
960	file	live code	not-opened	lib/db/drizzle/0008_reality_audit_snapshots.sql	Shared workspace library file. Contents not read.
2600	file	live code	not-opened	lib/db/drizzle/0009_codex.sql	Shared workspace library file. Contents not read.
73	file	live code	not-opened	lib/db/drizzle/0010_semantic_cache_model_default.sql	Shared workspace library file. Contents not read.
197	file	live code	not-opened	lib/db/drizzle/0011_forum_principal_token_revoke.sql	Shared workspace library file. Contents not read.
4790	file	live code	not-opened	lib/db/drizzle/meta/0000_snapshot.json	Shared workspace library file. Contents not read.
59426	file	live code	not-opened	lib/db/drizzle/meta/0001_snapshot.json	Shared workspace library file. Contents not read.
147051	file	live code	not-opened	lib/db/drizzle/meta/0007_snapshot.json	Shared workspace library file. Contents not read.
1843	file	live code	not-opened	lib/db/drizzle/meta/_journal.json	Shared workspace library file. Contents not read.
503	file	live code	opened	lib/db/package.json	Workspace package @workspace/db (Drizzle, pg).
1322	file	live code	not-opened	lib/db/sql/0011_pgvector_hnsw.sql	Shared workspace library file. Contents not read.
2706	file	live code	opened	lib/db/src/index.ts	Database client. Pool is created on getPool, not at import.
12896	file	live code	not-opened	lib/db/src/schema/codex.ts	Shared workspace library file. Contents not read.
7870	file	live code	not-opened	lib/db/src/schema/conversations.ts	Shared workspace library file. Contents not read.
590	file	live code	not-opened	lib/db/src/schema/council.ts	Shared workspace library file. Contents not read.
4969	file	live code	not-opened	lib/db/src/schema/departments.ts	Shared workspace library file. Contents not read.
1312	file	live code	not-opened	lib/db/src/schema/feedback.ts	Shared workspace library file. Contents not read.
5415	file	live code	not-opened	lib/db/src/schema/grand-evolution.ts	Shared workspace library file. Contents not read.
516	file	live code	not-opened	lib/db/src/schema/index.ts	Shared workspace library file. Contents not read.
3174	file	live code	not-opened	lib/db/src/schema/ingestion.ts	Shared workspace library file. Contents not read.
6134	file	live code	not-opened	lib/db/src/schema/intelligence.ts	Shared workspace library file. Contents not read.
4271	file	live code	not-opened	lib/db/src/schema/inventions.ts	Shared workspace library file. Contents not read.
2717	file	live code	not-opened	lib/db/src/schema/memory.ts	Shared workspace library file. Contents not read.
2252	file	live code	not-opened	lib/db/src/schema/natal-chart.ts	Shared workspace library file. Contents not read.
7731	file	live code	not-opened	lib/db/src/schema/phases-8-12.ts	Shared workspace library file. Contents not read.
6528	file	live code	not-opened	lib/db/src/schema/provider-sovereignty.ts	Shared workspace library file. Contents not read.
4155	file	live code	not-opened	lib/db/src/schema/reasoning.ts	Shared workspace library file. Contents not read.
882	file	live code	not-opened	lib/db/src/schema/security_audit_log.ts	Shared workspace library file. Contents not read.
1859	file	live code	not-opened	lib/db/src/schema/swarm.ts	Shared workspace library file. Contents not read.
3489	file	live code	not-opened	lib/db/src/schema/system.ts	Shared workspace library file. Contents not read.
244	file	live code	opened	lib/db/tsconfig.json	Composite project that emits declarations into dist/.
148493	file	live code	not-opened	lib/db/tsconfig.tsbuildinfo	Shared workspace library file. Contents not read.
465	file	docs	not-opened	mesh/curiosity.md	Mesh queue or note. Contents not read.
1100	file	docs	not-opened	mesh/queue/README.md	Mesh queue or note. Contents not read.
3272	file	live code	not-opened	mesh/queue/TASKS.mirror.json	Mesh queue or note. Contents not read.
919	file	live code	opened	package.json	Root workspace scripts, including pen:health.
7498	file	docs	not-opened	plan.md	Markdown note. Contents not read.
326774	file	live code	not-opened	pnpm-lock.yaml	Repository file. Contents not read.
6225	file	live code	opened	pnpm-workspace.yaml	Workspace globs and dependency overrides.
1428	file	docs	not-opened	preview/README.md	Desk preview file, outside the pnpm workspace globs. Contents not read.
1256	file	docs	not-opened	preview/TRUE-TODAY.md	Desk preview file, outside the pnpm workspace globs. Contents not read.
294	file	live code	not-opened	preview/index.html	Desk preview file, outside the pnpm workspace globs. Contents not read.
414	file	live code	opened	preview/package.json	Preview Vite app. Present on disk. Not a pnpm-workspace package.
4402	file	live code	not-opened	preview/public/fonts/OFL.txt	Desk preview file, outside the pnpm workspace globs. Contents not read.
25344	file	live code	not-opened	preview/public/fonts/fragment-mono.woff2	Desk preview file, outside the pnpm workspace globs. Contents not read.
14180	file	live code	not-opened	preview/public/fonts/syne-500.woff2	Desk preview file, outside the pnpm workspace globs. Contents not read.
14152	file	live code	not-opened	preview/public/fonts/syne-700.woff2	Desk preview file, outside the pnpm workspace globs. Contents not read.
1103	file	live code	not-opened	preview/public/sw.js	Desk preview file, outside the pnpm workspace globs. Contents not read.
932	file	live code	not-opened	preview/scripts/gen-offline-index.mjs	Desk preview file, outside the pnpm workspace globs. Contents not read.
881	file	live code	not-opened	preview/scripts/mesh-bundle.mjs	Desk preview file, outside the pnpm workspace globs. Contents not read.
1338	file	live code	not-opened	preview/scripts/mesh-bundle.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
668	file	live code	not-opened	preview/src/components/preview-host-bridge.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
5969	file	live code	not-opened	preview/src/components/tessera/app-shell.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
2759	file	live code	not-opened	preview/src/components/tessera/audit-cycles.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
1727	file	live code	not-opened	preview/src/components/tessera/bible-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
16130	file	live code	not-opened	preview/src/components/tessera/board-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
7331	file	live code	not-opened	preview/src/components/tessera/brain-mesh.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
1295	file	live code	not-opened	preview/src/components/tessera/brain-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
34139	file	live code	not-opened	preview/src/components/tessera/chamber.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
2999	file	live code	not-opened	preview/src/components/tessera/city-map.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
5882	file	live code	not-opened	preview/src/components/tessera/code-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
3825	file	live code	not-opened	preview/src/components/tessera/conversations-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
11214	file	live code	not-opened	preview/src/components/tessera/council-room.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
1870	file	live code	not-opened	preview/src/components/tessera/desk-drill.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
3828	file	live code	not-opened	preview/src/components/tessera/gitbook-ai-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
4780	file	live code	not-opened	preview/src/components/tessera/gitbook-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
3294	file	live code	not-opened	preview/src/components/tessera/house-live.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
6973	file	live code	not-opened	preview/src/components/tessera/language-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
5202	file	live code	not-opened	preview/src/components/tessera/lattice.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
6368	file	live code	not-opened	preview/src/components/tessera/learn-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
2308	file	live code	not-opened	preview/src/components/tessera/library-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
1056	file	live code	not-opened	preview/src/components/tessera/live-tick.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
98	file	live code	not-opened	preview/src/components/tessera/live-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
171	file	live code	not-opened	preview/src/components/tessera/living-loop.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
523	file	live code	not-opened	preview/src/components/tessera/mark.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
3315	file	live code	not-opened	preview/src/components/tessera/memory-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
650	file	live code	not-opened	preview/src/components/tessera/mesh-toggle.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
10080	file	live code	not-opened	preview/src/components/tessera/mind-chart.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
5425	file	live code	not-opened	preview/src/components/tessera/narrative-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
3446	file	live code	not-opened	preview/src/components/tessera/pulse-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
17237	file	live code	not-opened	preview/src/components/tessera/rick-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
3193	file	live code	not-opened	preview/src/components/tessera/rooms-sheet.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
1613	file	live code	not-opened	preview/src/components/tessera/secrets-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
17606	file	live code	not-opened	preview/src/components/tessera/self-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
980	file	live code	not-opened	preview/src/components/tessera/simulation.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
290	file	live code	not-opened	preview/src/components/tessera/status-line.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
2323	file	live code	not-opened	preview/src/components/tessera/synapse-live.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
3438	file	live code	not-opened	preview/src/components/tessera/theme-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
4298	file	live code	not-opened	preview/src/components/tessera/web-view.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
11901	file	live code	not-opened	preview/src/components/tessera/world-stage.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
15944	file	live code	not-opened	preview/src/lib/app-data/app-data.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
11867	file	live code	not-opened	preview/src/lib/app-data/client.server.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1994	file	live code	not-opened	preview/src/lib/app-data/errors.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
598	file	live code	not-opened	preview/src/lib/app-data/index.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
856	file	live code	not-opened	preview/src/lib/app-data/login.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1146	file	live code	not-opened	preview/src/lib/app-data/readiness-schedule.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
506	file	live code	not-opened	preview/src/lib/app-data/readiness-schedule.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
366	file	live code	not-opened	preview/src/lib/app-data/readiness.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
476	file	live code	not-opened	preview/src/lib/app-data/server-only.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1361	file	live code	not-opened	preview/src/lib/app-data/types.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3892	file	live code	not-opened	preview/src/lib/app-data/use-connector-readiness.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
9714	file	live code	not-opened	preview/src/lib/auth/client.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
442	file	live code	not-opened	preview/src/lib/auth/email-password.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5706	file	live code	not-opened	preview/src/lib/auth/gate-identity.server.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
14346	file	live code	not-opened	preview/src/lib/auth/gate-identity.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
879	file	live code	not-opened	preview/src/lib/auth/gate-session-marker.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
11980	file	live code	not-opened	preview/src/lib/auth/gate-session.server.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4924	file	live code	not-opened	preview/src/lib/auth/gates.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
2386	file	live code	not-opened	preview/src/lib/auth/isolation.server.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2462	file	live code	not-opened	preview/src/lib/auth/middleware.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4088	file	live code	not-opened	preview/src/lib/auth/pglite-dialect.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
6133	file	live code	not-opened	preview/src/lib/auth/popup.server.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1613	file	live code	not-opened	preview/src/lib/auth/preview.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
593	file	live code	not-opened	preview/src/lib/auth/provider.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
1486	file	live code	not-opened	preview/src/lib/auth/providers.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
12548	file	live code	not-opened	preview/src/lib/auth/server.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
854	file	live code	not-opened	preview/src/lib/auth/sign-in-gate.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
332	file	live code	not-opened	preview/src/lib/auth/sign-in-gate.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3315	file	live code	not-opened	preview/src/lib/auth/use-current-user.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3874	file	live code	not-opened	preview/src/lib/auth/verify.server.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
9525	file	live code	not-opened	preview/src/lib/db.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
880	file	live code	not-opened	preview/src/lib/dev-api-port.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
477	file	live code	not-opened	preview/src/lib/env.server.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1266	file	live code	not-opened	preview/src/lib/error-component.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
3075	file	live code	not-opened	preview/src/lib/mesh-node/mesh-node.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
7486	file	live code	not-opened	preview/src/lib/mesh-node/mesh-node.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1907	file	live code	not-opened	preview/src/lib/mesh-node/on-demand.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2163	file	live code	not-opened	preview/src/lib/mesh-node/on-demand.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
169	file	live code	not-opened	preview/src/lib/multiplayer/index.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
427	file	live code	not-opened	preview/src/lib/multiplayer/lan-mode.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
545	file	live code	not-opened	preview/src/lib/multiplayer/lan-mode.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
20579	file	live code	not-opened	preview/src/lib/multiplayer/p2p.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
907	file	live code	not-opened	preview/src/lib/offline/queue.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1945	file	live code	not-opened	preview/src/lib/offline/queue.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
206	file	live code	not-opened	preview/src/lib/offline/register-sw.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
467	file	live code	not-opened	preview/src/lib/offline/sw-strategy.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
520	file	live code	not-opened	preview/src/lib/offline/sw-strategy.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
66	file	live code	not-opened	preview/src/lib/og/site.json	Desk preview file, outside the pnpm workspace globs. Contents not read.
1855	file	live code	not-opened	preview/src/lib/preview-embedder-origin.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
9595	file	live code	not-opened	preview/src/lib/preview-host-bridge.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2918	file	live code	not-opened	preview/src/lib/secure-mesh/secure-mesh.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
6937	file	live code	not-opened	preview/src/lib/secure-mesh/secure-mesh.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2497	file	live code	not-opened	preview/src/lib/tessera/address-guard.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
369	file	live code	not-opened	preview/src/lib/tessera/admit-drop.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
332	file	live code	not-opened	preview/src/lib/tessera/admit-drop.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
457	file	live code	not-opened	preview/src/lib/tessera/agent-cycle.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3735	file	live code	not-opened	preview/src/lib/tessera/agent-cycle.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
394	file	live code	not-opened	preview/src/lib/tessera/agent-drill.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1898	file	live code	not-opened	preview/src/lib/tessera/agent-drill.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
793	file	live code	not-opened	preview/src/lib/tessera/agent-skills.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
592	file	live code	not-opened	preview/src/lib/tessera/all-cover.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1947	file	live code	not-opened	preview/src/lib/tessera/all-cover.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
685	file	live code	not-opened	preview/src/lib/tessera/archive-flow.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2205	file	live code	not-opened	preview/src/lib/tessera/archive-flow.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
671	file	live code	not-opened	preview/src/lib/tessera/as-herself.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
450	file	live code	not-opened	preview/src/lib/tessera/as-herself.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1874	file	live code	not-opened	preview/src/lib/tessera/ask-all.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
7617	file	live code	not-opened	preview/src/lib/tessera/ask-all.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1161	file	live code	not-opened	preview/src/lib/tessera/ask-memory.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4785	file	live code	not-opened	preview/src/lib/tessera/audit.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
824	file	live code	not-opened	preview/src/lib/tessera/batch-2.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
400	file	live code	not-opened	preview/src/lib/tessera/batch-2.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
880	file	live code	not-opened	preview/src/lib/tessera/batch-3-kept.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
406	file	live code	not-opened	preview/src/lib/tessera/batch-3-kept.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1033	file	live code	not-opened	preview/src/lib/tessera/batch-3.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1280	file	live code	not-opened	preview/src/lib/tessera/batch-3.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1382	file	live code	not-opened	preview/src/lib/tessera/batch-4.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
842	file	live code	not-opened	preview/src/lib/tessera/batch-4.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1004	file	live code	not-opened	preview/src/lib/tessera/batch-50.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
396	file	live code	not-opened	preview/src/lib/tessera/batch-50.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
670	file	live code	not-opened	preview/src/lib/tessera/bind-worker.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
735	file	live code	not-opened	preview/src/lib/tessera/brain-marks.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
423	file	live code	not-opened	preview/src/lib/tessera/brain-train.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1122	file	live code	not-opened	preview/src/lib/tessera/brain-train.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1307	file	live code	not-opened	preview/src/lib/tessera/brain-volume.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3080	file	live code	not-opened	preview/src/lib/tessera/brain-volume.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
577	file	live code	not-opened	preview/src/lib/tessera/bridge-strip.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
7852	file	live code	not-opened	preview/src/lib/tessera/bridge.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
748	file	live code	not-opened	preview/src/lib/tessera/build-now.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
667	file	live code	not-opened	preview/src/lib/tessera/build-now.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5477	file	live code	not-opened	preview/src/lib/tessera/canon.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
44416	file	live code	not-opened	preview/src/lib/tessera/catalog-pass.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1842	file	live code	not-opened	preview/src/lib/tessera/chamber-cycle.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2903	file	live code	not-opened	preview/src/lib/tessera/chamber-index.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1057	file	live code	not-opened	preview/src/lib/tessera/chamber-mark.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1250	file	live code	not-opened	preview/src/lib/tessera/chamber-methods.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
204	file	live code	not-opened	preview/src/lib/tessera/chat-bridge-strip.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
21478	file	live code	not-opened	preview/src/lib/tessera/chat.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1386	file	live code	not-opened	preview/src/lib/tessera/checkout-steps.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5375	file	live code	not-opened	preview/src/lib/tessera/checkout-steps.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2112	file	live code	not-opened	preview/src/lib/tessera/chronicle.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
531	file	live code	not-opened	preview/src/lib/tessera/city-clock.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
623	file	live code	not-opened	preview/src/lib/tessera/civic.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1240	file	live code	not-opened	preview/src/lib/tessera/civic.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4792	file	live code	not-opened	preview/src/lib/tessera/colonel.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
515	file	live code	not-opened	preview/src/lib/tessera/conference.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2849	file	live code	not-opened	preview/src/lib/tessera/conference.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5240	file	live code	not-opened	preview/src/lib/tessera/constitution-seal.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
318	file	live code	not-opened	preview/src/lib/tessera/copilot-seat.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
298	file	live code	not-opened	preview/src/lib/tessera/copilot-seat.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
9140	file	live code	not-opened	preview/src/lib/tessera/corpus.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
933	file	live code	not-opened	preview/src/lib/tessera/corrections.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
567	file	live code	not-opened	preview/src/lib/tessera/council-sitting.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1094	file	live code	not-opened	preview/src/lib/tessera/council-sitting.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
535	file	live code	not-opened	preview/src/lib/tessera/council.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1046	file	live code	not-opened	preview/src/lib/tessera/craft.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
6731	file	live code	not-opened	preview/src/lib/tessera/craft.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
476	file	live code	not-opened	preview/src/lib/tessera/create-her.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
776	file	live code	not-opened	preview/src/lib/tessera/create-her.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
952	file	live code	not-opened	preview/src/lib/tessera/curiosity.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3693	file	live code	not-opened	preview/src/lib/tessera/curiosity.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
676	file	live code	not-opened	preview/src/lib/tessera/cycles.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
9064	file	live code	not-opened	preview/src/lib/tessera/cycles.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
612	file	live code	not-opened	preview/src/lib/tessera/dark-join.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
417	file	live code	not-opened	preview/src/lib/tessera/dark-join.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
408	file	live code	not-opened	preview/src/lib/tessera/data-path.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
314	file	live code	not-opened	preview/src/lib/tessera/desk-same.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1133	file	live code	not-opened	preview/src/lib/tessera/desk-steps.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1791	file	live code	not-opened	preview/src/lib/tessera/desk-steps.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
10660	file	live code	not-opened	preview/src/lib/tessera/desk.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2480	file	live code	not-opened	preview/src/lib/tessera/drive-read.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
473	file	live code	not-opened	preview/src/lib/tessera/duplicate-guard.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
357	file	live code	not-opened	preview/src/lib/tessera/duplicate-guard.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
987	file	live code	not-opened	preview/src/lib/tessera/empath.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3027	file	live code	not-opened	preview/src/lib/tessera/empath.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
721	file	live code	not-opened	preview/src/lib/tessera/entry-trial.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1142	file	live code	not-opened	preview/src/lib/tessera/entry-trial.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
406	file	live code	not-opened	preview/src/lib/tessera/evolve.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1977	file	live code	not-opened	preview/src/lib/tessera/evolve.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
474	file	live code	not-opened	preview/src/lib/tessera/expand-3.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3918	file	live code	not-opened	preview/src/lib/tessera/expand-3.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3438	file	live code	not-opened	preview/src/lib/tessera/father-fed.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2325	file	live code	not-opened	preview/src/lib/tessera/father-profile.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
594	file	live code	not-opened	preview/src/lib/tessera/fed-archive.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1324	file	live code	not-opened	preview/src/lib/tessera/fed-archive.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
6915	file	live code	not-opened	preview/src/lib/tessera/fed-page.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3866	file	live code	not-opened	preview/src/lib/tessera/fed-vault.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
657	file	live code	not-opened	preview/src/lib/tessera/fed-world.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1464	file	live code	not-opened	preview/src/lib/tessera/fed-world.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
578	file	live code	not-opened	preview/src/lib/tessera/feed-10.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
557	file	live code	not-opened	preview/src/lib/tessera/feed.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2415	file	live code	not-opened	preview/src/lib/tessera/feed.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
721	file	live code	not-opened	preview/src/lib/tessera/file-follow.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
663	file	live code	not-opened	preview/src/lib/tessera/file-mesh.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1331	file	live code	not-opened	preview/src/lib/tessera/file-mesh.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
636	file	live code	not-opened	preview/src/lib/tessera/find-line.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
868	file	live code	not-opened	preview/src/lib/tessera/find-line.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2346	file	live code	not-opened	preview/src/lib/tessera/finish.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3630	file	live code	not-opened	preview/src/lib/tessera/finish.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
608	file	live code	not-opened	preview/src/lib/tessera/firm-combo.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2576	file	live code	not-opened	preview/src/lib/tessera/firm-combo.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
854	file	live code	not-opened	preview/src/lib/tessera/five-train.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4814	file	live code	not-opened	preview/src/lib/tessera/five-train.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
648	file	live code	not-opened	preview/src/lib/tessera/flow-v2.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
8608	file	live code	not-opened	preview/src/lib/tessera/flow-v2.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2361	file	live code	not-opened	preview/src/lib/tessera/foreman.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3350	file	live code	not-opened	preview/src/lib/tessera/foreman.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
878	file	live code	not-opened	preview/src/lib/tessera/forty-big.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3194	file	live code	not-opened	preview/src/lib/tessera/forty-big.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4419	file	live code	not-opened	preview/src/lib/tessera/forty.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5949	file	live code	not-opened	preview/src/lib/tessera/forty.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
58	file	live code	not-opened	preview/src/lib/tessera/from-the-files.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
8791	file	live code	not-opened	preview/src/lib/tessera/further-reading.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
606	file	live code	not-opened	preview/src/lib/tessera/gap-25.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4770	file	live code	not-opened	preview/src/lib/tessera/gap-25.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
269	file	live code	not-opened	preview/src/lib/tessera/gitbook-note.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
909	file	live code	not-opened	preview/src/lib/tessera/gitbook-orders.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2150	file	live code	not-opened	preview/src/lib/tessera/gitbook-orders.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
911311	file	live code	not-opened	preview/src/lib/tessera/gitbook-paths.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
409	file	live code	not-opened	preview/src/lib/tessera/github-desk.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
8970	file	live code	not-opened	preview/src/lib/tessera/github-desk.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
549	file	live code	not-opened	preview/src/lib/tessera/gitmesh-free.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
7652	file	live code	not-opened	preview/src/lib/tessera/gitmesh-free.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1347	file	live code	not-opened	preview/src/lib/tessera/glyphs.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5525	file	live code	not-opened	preview/src/lib/tessera/grok-ready.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
465	file	live code	not-opened	preview/src/lib/tessera/guard.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1769	file	live code	not-opened	preview/src/lib/tessera/guard.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
180038	file	live code	not-opened	preview/src/lib/tessera/held-packet.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
843	file	live code	not-opened	preview/src/lib/tessera/her-help.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2707	file	live code	not-opened	preview/src/lib/tessera/her-voice.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3011	file	live code	not-opened	preview/src/lib/tessera/her-voice.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
413	file	live code	not-opened	preview/src/lib/tessera/herself-v2.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1072	file	live code	not-opened	preview/src/lib/tessera/herself-v2.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
874	file	live code	not-opened	preview/src/lib/tessera/herself-v3.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1455	file	live code	not-opened	preview/src/lib/tessera/herself-v3.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
717	file	live code	not-opened	preview/src/lib/tessera/herself-v4.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2179	file	live code	not-opened	preview/src/lib/tessera/herself-v4.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
637	file	live code	not-opened	preview/src/lib/tessera/herself-v5.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1615	file	live code	not-opened	preview/src/lib/tessera/herself-v5.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1043	file	live code	not-opened	preview/src/lib/tessera/house-sim.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
7694	file	live code	not-opened	preview/src/lib/tessera/hundred.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
513	file	live code	not-opened	preview/src/lib/tessera/hyb011-exclusions.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1374	file	live code	not-opened	preview/src/lib/tessera/hyb011-exclusions.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
14636	file	live code	not-opened	preview/src/lib/tessera/identity.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2750	file	live code	not-opened	preview/src/lib/tessera/imported-laws.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
452	file	live code	not-opened	preview/src/lib/tessera/improve-loop.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4804	file	live code	not-opened	preview/src/lib/tessera/improve-loop.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
618	file	live code	not-opened	preview/src/lib/tessera/improve-measure.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2511	file	live code	not-opened	preview/src/lib/tessera/improve-measure.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5802	file	live code	not-opened	preview/src/lib/tessera/ingest.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
579	file	live code	not-opened	preview/src/lib/tessera/invention-log.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1088	file	live code	not-opened	preview/src/lib/tessera/invention-log.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
651	file	live code	not-opened	preview/src/lib/tessera/j-spot.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1477	file	live code	not-opened	preview/src/lib/tessera/j-spot.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
685	file	live code	not-opened	preview/src/lib/tessera/join-web.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1364	file	live code	not-opened	preview/src/lib/tessera/join-web.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
766	file	live code	not-opened	preview/src/lib/tessera/kept-lessons.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1049	file	live code	not-opened	preview/src/lib/tessera/kept-lessons.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
790	file	live code	not-opened	preview/src/lib/tessera/kingdom.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1276	file	live code	not-opened	preview/src/lib/tessera/kingdom.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
998	file	live code	not-opened	preview/src/lib/tessera/kiwix.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1143	file	live code	not-opened	preview/src/lib/tessera/kiwix.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
572	file	live code	not-opened	preview/src/lib/tessera/lab-audit.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3534	file	live code	not-opened	preview/src/lib/tessera/lab-audit.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1507	file	live code	not-opened	preview/src/lib/tessera/lab-run.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
713	file	live code	not-opened	preview/src/lib/tessera/lack-again.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
612	file	live code	not-opened	preview/src/lib/tessera/lack-again.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
6256	file	live code	not-opened	preview/src/lib/tessera/learning.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5594	file	live code	not-opened	preview/src/lib/tessera/line-reading.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
31831	file	live code	not-opened	preview/src/lib/tessera/lingua.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4217	file	live code	not-opened	preview/src/lib/tessera/list-003.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
779	file	live code	not-opened	preview/src/lib/tessera/live-map.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2093	file	live code	not-opened	preview/src/lib/tessera/live-map.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
516	file	live code	not-opened	preview/src/lib/tessera/local-learn.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
815	file	live code	not-opened	preview/src/lib/tessera/local-learn.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1380	file	live code	not-opened	preview/src/lib/tessera/local-route.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1191	file	live code	not-opened	preview/src/lib/tessera/loop-20.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1718	file	live code	not-opened	preview/src/lib/tessera/loop-20.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
594	file	live code	not-opened	preview/src/lib/tessera/love-local.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
849	file	live code	not-opened	preview/src/lib/tessera/love-local.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1154	file	live code	not-opened	preview/src/lib/tessera/main-gap.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
981	file	live code	not-opened	preview/src/lib/tessera/matter-80.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
20030	file	live code	not-opened	preview/src/lib/tessera/matter-80.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1041	file	live code	not-opened	preview/src/lib/tessera/memory-web.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4287	file	live code	not-opened	preview/src/lib/tessera/memory-web.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
981	file	live code	not-opened	preview/src/lib/tessera/mesh-net.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2798	file	live code	not-opened	preview/src/lib/tessera/mesh-net.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1138	file	live code	not-opened	preview/src/lib/tessera/mesh-nodes.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
447	file	live code	not-opened	preview/src/lib/tessera/mesh-status.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
391	file	live code	not-opened	preview/src/lib/tessera/mesh-status.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1489	file	live code	not-opened	preview/src/lib/tessera/mesh-steps.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3912	file	live code	not-opened	preview/src/lib/tessera/mesh-steps.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1040	file	live code	not-opened	preview/src/lib/tessera/mesh-tongue.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
511	file	live code	not-opened	preview/src/lib/tessera/method.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
736	file	live code	not-opened	preview/src/lib/tessera/method.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
454	file	live code	not-opened	preview/src/lib/tessera/moltbook-link.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
576	file	live code	not-opened	preview/src/lib/tessera/moltbook-link.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1361	file	live code	not-opened	preview/src/lib/tessera/named-task.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
11671	file	live code	not-opened	preview/src/lib/tessera/narrative.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1590	file	live code	not-opened	preview/src/lib/tessera/next-page.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1155	file	live code	not-opened	preview/src/lib/tessera/next-page.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
886	file	live code	not-opened	preview/src/lib/tessera/offline-index.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1032	file	live code	not-opened	preview/src/lib/tessera/offline-index.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
802	file	live code	not-opened	preview/src/lib/tessera/offline-read.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
485	file	live code	not-opened	preview/src/lib/tessera/offline-read.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
933	file	live code	not-opened	preview/src/lib/tessera/one-flow.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2627	file	live code	not-opened	preview/src/lib/tessera/one-flow.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3380	file	live code	not-opened	preview/src/lib/tessera/open-26.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4722	file	live code	not-opened	preview/src/lib/tessera/open-26.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1099	file	live code	not-opened	preview/src/lib/tessera/opening.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5839	file	live code	not-opened	preview/src/lib/tessera/opening.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3558	file	live code	not-opened	preview/src/lib/tessera/own-lab.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
591	file	live code	not-opened	preview/src/lib/tessera/own-step.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1906	file	live code	not-opened	preview/src/lib/tessera/own-step.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1106	file	live code	not-opened	preview/src/lib/tessera/own-versions.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2805	file	live code	not-opened	preview/src/lib/tessera/own-versions.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1023	file	live code	not-opened	preview/src/lib/tessera/pack.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1764	file	live code	not-opened	preview/src/lib/tessera/pack.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
593	file	live code	not-opened	preview/src/lib/tessera/part-index.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2764	file	live code	not-opened	preview/src/lib/tessera/part-index.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
634	file	live code	not-opened	preview/src/lib/tessera/pass.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1005	file	live code	not-opened	preview/src/lib/tessera/pass.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1143	file	live code	not-opened	preview/src/lib/tessera/path-delta.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
997	file	live code	not-opened	preview/src/lib/tessera/path-delta.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
636	file	live code	not-opened	preview/src/lib/tessera/perceptron.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1314	file	live code	not-opened	preview/src/lib/tessera/perceptron.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
669	file	live code	not-opened	preview/src/lib/tessera/portrait-mark.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
731	file	live code	not-opened	preview/src/lib/tessera/portrait-mark.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1563	file	live code	not-opened	preview/src/lib/tessera/prompt.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
15271	file	live code	not-opened	preview/src/lib/tessera/prompt.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2504	file	live code	not-opened	preview/src/lib/tessera/proof.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1815	file	live code	not-opened	preview/src/lib/tessera/public-board.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
556	file	live code	not-opened	preview/src/lib/tessera/public-gate.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
634	file	live code	not-opened	preview/src/lib/tessera/public-gate.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2008	file	live code	not-opened	preview/src/lib/tessera/public-question.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1499	file	live code	not-opened	preview/src/lib/tessera/public-question.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3481	file	live code	not-opened	preview/src/lib/tessera/puzzle-thirty.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
606	file	live code	not-opened	preview/src/lib/tessera/questions.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2397	file	live code	not-opened	preview/src/lib/tessera/questions.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
603	file	live code	not-opened	preview/src/lib/tessera/read-piece.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1532	file	live code	not-opened	preview/src/lib/tessera/read-piece.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
830	file	live code	not-opened	preview/src/lib/tessera/read-work.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2175	file	live code	not-opened	preview/src/lib/tessera/read-work.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1500	file	live code	not-opened	preview/src/lib/tessera/reality.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2685	file	live code	not-opened	preview/src/lib/tessera/reality.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
575	file	live code	not-opened	preview/src/lib/tessera/recall-all.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3583	file	live code	not-opened	preview/src/lib/tessera/recall-all.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
762	file	live code	not-opened	preview/src/lib/tessera/recall-hop.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1468	file	live code	not-opened	preview/src/lib/tessera/recall-hop.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
375	file	live code	not-opened	preview/src/lib/tessera/recall-sheet.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1375	file	live code	not-opened	preview/src/lib/tessera/recall-sheet.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
7489	file	live code	not-opened	preview/src/lib/tessera/recall.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1195	file	live code	not-opened	preview/src/lib/tessera/recursive-proof.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3255	file	live code	not-opened	preview/src/lib/tessera/recursive-proof.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1796	file	live code	not-opened	preview/src/lib/tessera/recursive-train.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4961	file	live code	not-opened	preview/src/lib/tessera/recursive-train.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
639	file	live code	not-opened	preview/src/lib/tessera/reflect.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1777	file	live code	not-opened	preview/src/lib/tessera/repo-ask.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
6316	file	live code	not-opened	preview/src/lib/tessera/repo-ask.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4937	file	live code	not-opened	preview/src/lib/tessera/repo-delta.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
773	file	live code	not-opened	preview/src/lib/tessera/repo-guard.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
461	file	live code	not-opened	preview/src/lib/tessera/repo-guard.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
939	file	live code	not-opened	preview/src/lib/tessera/repo-ledger.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
19951	file	live code	not-opened	preview/src/lib/tessera/repo-ledger.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
833	file	live code	not-opened	preview/src/lib/tessera/retain.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3431	file	live code	not-opened	preview/src/lib/tessera/retain.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
772	file	live code	not-opened	preview/src/lib/tessera/reverse-cause.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
641	file	live code	not-opened	preview/src/lib/tessera/reverse-cause.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
385	file	live code	not-opened	preview/src/lib/tessera/reward-tick.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
220	file	live code	not-opened	preview/src/lib/tessera/reward-tick.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2489	file	live code	not-opened	preview/src/lib/tessera/rick-five.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3649	file	live code	not-opened	preview/src/lib/tessera/rick-five.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1459	file	live code	not-opened	preview/src/lib/tessera/rick-home.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5701	file	live code	not-opened	preview/src/lib/tessera/rick-home.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1599	file	live code	not-opened	preview/src/lib/tessera/rick-loop.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1664	file	live code	not-opened	preview/src/lib/tessera/rick-loop.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
502	file	live code	not-opened	preview/src/lib/tessera/rick-metrics.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
7935	file	live code	not-opened	preview/src/lib/tessera/rick-metrics.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
491	file	live code	not-opened	preview/src/lib/tessera/rick-shift.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1001	file	live code	not-opened	preview/src/lib/tessera/rick-shift.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
873	file	live code	not-opened	preview/src/lib/tessera/rick-thirty.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
6281	file	live code	not-opened	preview/src/lib/tessera/rick-thirty.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
859	file	live code	not-opened	preview/src/lib/tessera/room-guard.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1004	file	live code	not-opened	preview/src/lib/tessera/room-guard.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
518	file	live code	not-opened	preview/src/lib/tessera/room-world.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
742	file	live code	not-opened	preview/src/lib/tessera/room-world.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
835	file	live code	not-opened	preview/src/lib/tessera/root-skills.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2426	file	live code	not-opened	preview/src/lib/tessera/root-skills.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
633	file	live code	not-opened	preview/src/lib/tessera/sched.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1176	file	live code	not-opened	preview/src/lib/tessera/school-match.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
10142	file	live code	not-opened	preview/src/lib/tessera/school.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2482	file	live code	not-opened	preview/src/lib/tessera/scope-stop.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1882	file	live code	not-opened	preview/src/lib/tessera/sdk.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2410	file	live code	not-opened	preview/src/lib/tessera/secret-engines.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
12082	file	live code	not-opened	preview/src/lib/tessera/secret-engines.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
383	file	live code	not-opened	preview/src/lib/tessera/section-step.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
302	file	live code	not-opened	preview/src/lib/tessera/section-step.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
672	file	live code	not-opened	preview/src/lib/tessera/self-build.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2511	file	live code	not-opened	preview/src/lib/tessera/self-build.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
609	file	live code	not-opened	preview/src/lib/tessera/self-improve.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1549	file	live code	not-opened	preview/src/lib/tessera/self-improve.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
496	file	live code	not-opened	preview/src/lib/tessera/self-ingest.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4743	file	live code	not-opened	preview/src/lib/tessera/self-ingest.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
436	file	live code	not-opened	preview/src/lib/tessera/session-mark.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5873	file	live code	not-opened	preview/src/lib/tessera/seven-repos.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
452	file	live code	not-opened	preview/src/lib/tessera/shared-house.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
715	file	live code	not-opened	preview/src/lib/tessera/shared-house.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
444	file	live code	not-opened	preview/src/lib/tessera/shelf.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
787	file	live code	not-opened	preview/src/lib/tessera/shelf.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
846	file	live code	not-opened	preview/src/lib/tessera/sigil-gate.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3293	file	live code	not-opened	preview/src/lib/tessera/silent-pen.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
12814	file	live code	not-opened	preview/src/lib/tessera/silent-pen.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
478	file	live code	not-opened	preview/src/lib/tessera/sitting-25.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5621	file	live code	not-opened	preview/src/lib/tessera/sitting-25.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4145	file	live code	not-opened	preview/src/lib/tessera/sitting.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5542	file	live code	not-opened	preview/src/lib/tessera/sixty.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1358	file	live code	not-opened	preview/src/lib/tessera/skill-context.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1893	file	live code	not-opened	preview/src/lib/tessera/skill-context.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
571	file	live code	not-opened	preview/src/lib/tessera/skill-drill.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1523	file	live code	not-opened	preview/src/lib/tessera/skill-drill.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
543	file	live code	not-opened	preview/src/lib/tessera/skill-index.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
9351	file	live code	not-opened	preview/src/lib/tessera/skill-index.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4518	file	live code	not-opened	preview/src/lib/tessera/skill-use.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
10136	file	live code	not-opened	preview/src/lib/tessera/society.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
420	file	live code	not-opened	preview/src/lib/tessera/source-gate.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
337	file	live code	not-opened	preview/src/lib/tessera/source-gate.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2795	file	live code	not-opened	preview/src/lib/tessera/sovereign-desk.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5699	file	live code	not-opened	preview/src/lib/tessera/sovereign-desk.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1049	file	live code	not-opened	preview/src/lib/tessera/sparse-read.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2624	file	live code	not-opened	preview/src/lib/tessera/sparse-read.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
653	file	live code	not-opened	preview/src/lib/tessera/spin-machine.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2301	file	live code	not-opened	preview/src/lib/tessera/spin-machine.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
844	file	live code	not-opened	preview/src/lib/tessera/spin.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1057	file	live code	not-opened	preview/src/lib/tessera/spin.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
367	file	live code	not-opened	preview/src/lib/tessera/sponge.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3377	file	live code	not-opened	preview/src/lib/tessera/sponge.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
433	file	live code	not-opened	preview/src/lib/tessera/step-math.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
9900	file	live code	not-opened	preview/src/lib/tessera/store.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
602	file	live code	not-opened	preview/src/lib/tessera/stride.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4749	file	live code	not-opened	preview/src/lib/tessera/stride.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
8697	file	live code	not-opened	preview/src/lib/tessera/studies.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1368	file	live code	not-opened	preview/src/lib/tessera/study-catalog.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
109385	file	live code	not-opened	preview/src/lib/tessera/study-log.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
570	file	live code	not-opened	preview/src/lib/tessera/study-next.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1324	file	live code	not-opened	preview/src/lib/tessera/study.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
9980	file	live code	not-opened	preview/src/lib/tessera/study.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
484	file	live code	not-opened	preview/src/lib/tessera/suite-rules.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3495	file	live code	not-opened	preview/src/lib/tessera/suite-rules.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1538	file	live code	not-opened	preview/src/lib/tessera/swarm-gate.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
3943	file	live code	not-opened	preview/src/lib/tessera/swarm-round.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
305	file	live code	not-opened	preview/src/lib/tessera/ten-big.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4091	file	live code	not-opened	preview/src/lib/tessera/ten-big.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
304639	file	live code	not-opened	preview/src/lib/tessera/tessera-paths.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1374	file	live code	not-opened	preview/src/lib/tessera/themes.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
329	file	live code	not-opened	preview/src/lib/tessera/themes.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1014	file	live code	not-opened	preview/src/lib/tessera/token-graph.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
4503	file	live code	not-opened	preview/src/lib/tessera/token-graph.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2610	file	live code	not-opened	preview/src/lib/tessera/token-index.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
866	file	live code	not-opened	preview/src/lib/tessera/tools.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
553	file	live code	not-opened	preview/src/lib/tessera/train-pass.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1775	file	live code	not-opened	preview/src/lib/tessera/train-pass.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
315	file	live code	not-opened	preview/src/lib/tessera/tree-steps.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
629	file	live code	not-opened	preview/src/lib/tessera/tunnel.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
616	file	live code	not-opened	preview/src/lib/tessera/tunnel.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2907	file	live code	not-opened	preview/src/lib/tessera/twenty-six.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2479	file	live code	not-opened	preview/src/lib/tessera/twenty.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1765	file	live code	not-opened	preview/src/lib/tessera/vault-index.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
22907	file	live code	not-opened	preview/src/lib/tessera/vote-record.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2726	file	live code	not-opened	preview/src/lib/tessera/watch-loop.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2524	file	live code	not-opened	preview/src/lib/tessera/watch-loop.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2693	file	live code	not-opened	preview/src/lib/tessera/wave-1.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2208	file	live code	not-opened	preview/src/lib/tessera/wave-1.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
252	file	live code	not-opened	preview/src/lib/tessera/wave-2.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1620	file	live code	not-opened	preview/src/lib/tessera/wave-2.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
266	file	live code	not-opened	preview/src/lib/tessera/wave-3.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1763	file	live code	not-opened	preview/src/lib/tessera/wave-3.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
270	file	live code	not-opened	preview/src/lib/tessera/wave-4.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1258	file	live code	not-opened	preview/src/lib/tessera/wave-4.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
264	file	live code	not-opened	preview/src/lib/tessera/wave-5.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1612	file	live code	not-opened	preview/src/lib/tessera/wave-5.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
262	file	live code	not-opened	preview/src/lib/tessera/wave-6.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2080	file	live code	not-opened	preview/src/lib/tessera/wave-6.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
282	file	live code	not-opened	preview/src/lib/tessera/wave-7.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1341	file	live code	not-opened	preview/src/lib/tessera/wave-7.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
272	file	live code	not-opened	preview/src/lib/tessera/wave-8.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1684	file	live code	not-opened	preview/src/lib/tessera/wave-8.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
278	file	live code	not-opened	preview/src/lib/tessera/wave-9.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1663	file	live code	not-opened	preview/src/lib/tessera/wave-9.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1107	file	live code	not-opened	preview/src/lib/tessera/wave.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5009	file	live code	not-opened	preview/src/lib/tessera/wave.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
595	file	live code	not-opened	preview/src/lib/tessera/whiten.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
681	file	live code	not-opened	preview/src/lib/tessera/whiten.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2243	file	live code	not-opened	preview/src/lib/tessera/workshop.test.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
5787	file	live code	not-opened	preview/src/lib/tessera/workshop.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2669	file	live code	not-opened	preview/src/lib/tessera/world.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
425	file	live code	not-opened	preview/src/main.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
3267	file	live code	not-opened	preview/src/routeTree.gen.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
272	file	live code	not-opened	preview/src/router.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
1615	file	live code	not-opened	preview/src/routes/__root.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
311	file	live code	not-opened	preview/src/routes/api/tessera/ask.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
311	file	live code	not-opened	preview/src/routes/api/tessera/mcp.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
226	file	live code	not-opened	preview/src/routes/index.tsx	Desk preview file, outside the pnpm workspace globs. Contents not read.
5153	file	live code	not-opened	preview/src/styles.css	Desk preview file, outside the pnpm workspace globs. Contents not read.
79	file	live code	not-opened	preview/src/vite-env.d.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
1474	file	live code	not-opened	preview/tsconfig.json	Desk preview file, outside the pnpm workspace globs. Contents not read.
2341	file	live code	not-opened	preview/vite.config.ts	Desk preview file, outside the pnpm workspace globs. Contents not read.
2149	file	docs	not-opened	research/mesh-moltbook/README.md	Research note or experiment. Contents not read.
416	file	live code	not-opened	research/mesh-moltbook/package.json	Research note or experiment. Contents not read.
1535	file	live code	not-opened	research/mesh-moltbook/src/agents.js	Research note or experiment. Contents not read.
1190	file	live code	not-opened	research/mesh-moltbook/src/cli.js	Research note or experiment. Contents not read.
1815	file	live code	not-opened	research/mesh-moltbook/src/identity.js	Research note or experiment. Contents not read.
6459	file	live code	not-opened	research/mesh-moltbook/src/moltbook.js	Research note or experiment. Contents not read.
1921	file	live code	not-opened	research/mesh-moltbook/src/names.js	Research note or experiment. Contents not read.
10927	file	live code	not-opened	research/mesh-moltbook/src/node.js	Research note or experiment. Contents not read.
1828	file	live code	not-opened	research/mesh-moltbook/src/scenario.js	Research note or experiment. Contents not read.
3536	file	live code	not-opened	research/mesh-moltbook/src/sim.js	Research note or experiment. Contents not read.
814	file	live code	not-opened	research/mesh-moltbook/test/determinism.test.js	Research note or experiment. Contents not read.
397	file	live code	not-opened	research/mesh-moltbook/test/helpers.js	Research note or experiment. Contents not read.
4865	file	live code	not-opened	research/mesh-moltbook/test/moltbook.test.js	Research note or experiment. Contents not read.
1753	file	live code	not-opened	research/mesh-moltbook/test/names-identity.test.js	Research note or experiment. Contents not read.
3918	file	live code	not-opened	research/mesh-moltbook/test/routing.test.js	Research note or experiment. Contents not read.
2125	file	live code	not-opened	research/mesh-moltbook/test/store-forward.test.js	Research note or experiment. Contents not read.
1639	file	docs	not-opened	research/own-brain/README.md	Research note or experiment. Contents not read.
7804	file	live code	not-opened	research/own-brain/lif.py	Research note or experiment. Contents not read.
2584	file	live code	not-opened	research/own-brain/scale-results.json	Research note or experiment. Contents not read.
3400	file	live code	not-opened	research/own-brain/scale_ladder.py	Research note or experiment. Contents not read.
1879	file	live code	not-opened	research/own-brain/test_lif.py	Research note or experiment. Contents not read.
4869	file	live code	not-opened	scripts/bench-latency.mjs	Suite script or test. Contents not read.
1501	file	live code	not-opened	scripts/build-unified.mjs	Suite script or test. Contents not read.
3218	file	live code	not-opened	scripts/check-task-mirror.mjs	Suite script or test. Contents not read.
2572	file	live code	not-opened	scripts/check-task-mirror.test.mjs	Suite script or test. Contents not read.
1263	file	live code	not-opened	scripts/clone-lean.sh	Suite script or test. Contents not read.
18715	file	live code	not-opened	scripts/convene-natal-key-conference.test.mjs	Suite script or test. Contents not read.
4433	file	live code	opened	scripts/dev-unified.mjs	Starts web and mockup sandbox. Starts the API only for a loopback DATABASE_URL.
3381	file	live code	not-opened	scripts/eval/write-result.mjs	Suite script or test. Contents not read.
3077	file	live code	not-opened	scripts/eval/write-result.test.mjs	Suite script or test. Contents not read.
1031	file	docs	not-opened	scripts/feedback/README.md	Suite script or test. Contents not read.
6399	file	live code	not-opened	scripts/feedback/outcome-feedback.mjs	Suite script or test. Contents not read.
3903	file	live code	not-opened	scripts/feedback/outcome-feedback.test.mjs	Suite script or test. Contents not read.
1698	file	live code	not-opened	scripts/fixtures/main-provenance.json	Suite script or test. Contents not read.
636	file	live code	not-opened	scripts/fixtures/pr-author-check.json	Suite script or test. Contents not read.
241	file	live code	not-opened	scripts/fixtures/pr-diff-scan.json	Suite script or test. Contents not read.
3244	file	live code	not-opened	scripts/gitleaks-fixture-test.mjs	Suite script or test. Contents not read.
2974	file	live code	not-opened	scripts/gitleaks-scan.mjs	Suite script or test. Contents not read.
4621	file	live code	not-opened	scripts/gitleaks-scan.test.mjs	Suite script or test. Contents not read.
5838	file	live code	not-opened	scripts/historical-merge-gate.mjs	Suite script or test. Contents not read.
1415	file	live code	not-opened	scripts/historical-merge-gate.test.mjs	Suite script or test. Contents not read.
728	file	live code	not-opened	scripts/install-gitleaks.sh	Suite script or test. Contents not read.
2090	file	live code	not-opened	scripts/loop/findings.mjs	Suite script or test. Contents not read.
3132	file	live code	not-opened	scripts/loop/loop.test.mjs	Suite script or test. Contents not read.
2054	file	live code	not-opened	scripts/loop/meta.mjs	Suite script or test. Contents not read.
2179	file	live code	not-opened	scripts/loop/patch-check.mjs	Suite script or test. Contents not read.
903	file	live code	not-opened	scripts/loop/pr-cache.mjs	Suite script or test. Contents not read.
795	file	live code	not-opened	scripts/loop/pr-cache.test.mjs	Suite script or test. Contents not read.
568	file	live code	not-opened	scripts/loop/runner-select.mjs	Suite script or test. Contents not read.
3540	file	live code	not-opened	scripts/loop/scores.mjs	Suite script or test. Contents not read.
410	file	live code	not-opened	scripts/loop/trusted-authors.jq	Suite script or test. Contents not read.
6050	file	live code	not-opened	scripts/loop/worker-validators.test.mjs	Suite script or test. Contents not read.
9502	file	live code	not-opened	scripts/loop/worker.mjs	Suite script or test. Contents not read.
7491	file	live code	not-opened	scripts/main-provenance.mjs	Suite script or test. Contents not read.
8889	file	live code	not-opened	scripts/main-provenance.test.mjs	Suite script or test. Contents not read.
1029	file	live code	opened	scripts/package.json	Scripts package. Its test list includes pen-health.test.mjs.
6095	file	live code	opened	scripts/pen-health.mjs	Health check added in this change. Does not enable the pen.
1973	file	live code	opened	scripts/pen-health.test.mjs	Node test for the pen health check.
6644	file	live code	not-opened	scripts/pr-author-check.mjs	Suite script or test. Contents not read.
8135	file	live code	not-opened	scripts/pr-author-check.test.mjs	Suite script or test. Contents not read.
8304	file	live code	not-opened	scripts/pr-diff-scan.mjs	Suite script or test. Contents not read.
7059	file	live code	not-opened	scripts/pr-diff-scan.test.mjs	Suite script or test. Contents not read.
27374	file	live code	not-opened	scripts/rea-registry.mjs	Suite script or test. Contents not read.
14168	file	live code	not-opened	scripts/rea-registry.test.mjs	Suite script or test. Contents not read.
4698	file	live code	not-opened	scripts/ready-for-gate-comment.mjs	Suite script or test. Contents not read.
6096	file	live code	not-opened	scripts/ready-for-gate-comment.test.mjs	Suite script or test. Contents not read.
6122	file	live code	not-opened	scripts/scan-cache.mjs	Suite script or test. Contents not read.
2377	file	live code	not-opened	scripts/scan-cache.test.mjs	Suite script or test. Contents not read.
4187	file	docs	not-opened	scripts/scorecard/README.md	Suite script or test. Contents not read.
5515	file	live code	not-opened	scripts/scorecard/agi_proxy.mjs	Suite script or test. Contents not read.
2270	file	live code	not-opened	scripts/scorecard/box-run.sh	Suite script or test. Contents not read.
2883	file	live code	not-opened	scripts/scorecard/consciousness_proxy.py	Suite script or test. Contents not read.
3757	file	live code	not-opened	scripts/scorecard/fixtures/recall-fixture.json	Suite script or test. Contents not read.
730	file	live code	not-opened	scripts/scorecard/lib.mjs	Suite script or test. Contents not read.
3285	file	live code	not-opened	scripts/scorecard/recall_at_k.mjs	Suite script or test. Contents not read.
5537	file	live code	not-opened	scripts/scorecard/recursion_rate.mjs	Suite script or test. Contents not read.
1901	file	live code	not-opened	scripts/scorecard/scorecard-args.test.mjs	Suite script or test. Contents not read.
4491	file	live code	not-opened	scripts/scorecard/scorecard.mjs	Suite script or test. Contents not read.
10198	file	live code	not-opened	scripts/scorecard/scorecard.test.mjs	Suite script or test. Contents not read.
3963	file	docs	not-opened	scripts/selfbuild/README.md	Suite script or test. Contents not read.
2034	file	docs	not-opened	scripts/selfbuild/RESULTS.md	Suite script or test. Contents not read.
504	file	docs	not-opened	scripts/selfbuild/fixtures/NEXT.md	Suite script or test. Contents not read.
26250	file	live code	not-opened	scripts/selfbuild/selfbuild.mjs	Suite script or test. Contents not read.
12957	file	live code	not-opened	scripts/selfbuild/selfbuild.test.mjs	Suite script or test. Contents not read.
46	file	live code	not-opened	scripts/src/hello.ts	Suite script or test. Contents not read.
2762	file	live code	not-opened	scripts/suite-policy.mjs	Suite script or test. Contents not read.
2724	file	live code	not-opened	scripts/suite-policy.test.mjs	Suite script or test. Contents not read.
1656	file	live code	not-opened	scripts/tessera-routes-manifest.mjs	Suite script or test. Contents not read.
1233	file	live code	not-opened	scripts/tessera-routes-manifest.test.mjs	Suite script or test. Contents not read.
3942	file	live code	opened	scripts/test-unified.mjs	Root test runner. Starts the API tests only for a loopback test database.
157	file	live code	not-opened	scripts/tsconfig.json	Suite script or test. Contents not read.
4027	file	live code	opened	scripts/workspace-shell.test.mjs	UI shell regression test. Opened only at the top.
3727	file	live code	not-opened	skills-lock.json	Repository file. Contents not read.
3083	file	live code	not-opened	tools/bench/harness.mjs	Repo tool. Contents not read.
1981	file	docs	not-opened	tools/deltabundle/README.md	Repo tool. Contents not read.
1864	file	docs	not-opened	tools/deltabundle/RESULTS.md	Repo tool. Contents not read.
6885	file	live code	not-opened	tools/deltabundle/bench.mjs	Repo tool. Contents not read.
13176	file	live code	not-opened	tools/deltabundle/deltabundle.mjs	Repo tool. Contents not read.
12903	file	live code	not-opened	tools/deltabundle/deltabundle.test.mjs	Repo tool. Contents not read.
5502	file	docs	not-opened	tools/etagcache/RESULTS.md	Repo tool. Contents not read.
11413	file	live code	not-opened	tools/etagcache/etagcache.mjs	Repo tool. Contents not read.
22719	file	live code	not-opened	tools/etagcache/etagcache.test.mjs	Repo tool. Contents not read.
2172	file	docs	not-opened	tools/pregate/CHECKLIST.md	Repo tool. Contents not read.
5474	file	docs	not-opened	tools/pregate/RESULTS.md	Repo tool. Contents not read.
8100	file	live code	not-opened	tools/pregate/pregate.test.mjs	Repo tool. Contents not read.
18323	file	live code	not-opened	tools/pregate/run.mjs	Repo tool. Contents not read.
667	file	live code	opened	tsconfig.base.json	Shared TypeScript compiler options.
236	file	live code	opened	tsconfig.json	Project references for lib/db, lib/api-client-react, and lib/api-zod.
```


## This file

TESTED: `docs/INVENTORY-2026-10-21.md` is 656534 bytes before this addendum paragraph. It is a docs file. It was written by this session.

This inventory file is outside the 3821-file walk. The tables above do not list it.
