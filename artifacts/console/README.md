# Tessera console

Tessera Next is the current UI. It is one Node process on **127.0.0.1:4391**. `/api/meta` reports `theme: "tessera-next"`.

```bash
pnpm --filter @workspace/console run dev
```

The process binds `127.0.0.1` only. That address is not read from the environment. `TESSERA_CONSOLE_PORT` overrides the port. `TESSERA_CONSOLE_MEMORY` overrides the gitignored retrieval-memory directory (default `.local/tessera-console-memory`). This app does not read or set `TESSERA_ENABLE_*`.

Static files are read when the process starts, from fixed paths inside `public/`. A request is served only when its path is an exact allowlist key. Paths containing `%`, `..`, or a backslash are rejected and never joined onto the filesystem. `POST /api/chat` accepts only `Origin: http://127.0.0.1:<port>` on that loopback socket. A browser on the console page sends that header. Other origins get 403.

| Tab | Real source |
| --- | --- |
| Eye | Tail of `docs/v2/v2-memory.jsonl`, the in-process agent bus, and retrieval-memory rows written by Chat |
| Brain | `loadGraph` / `replayAt` / Hebbian synapses on that same memory log, with a time slider. `BRAIN_TAB=1` replaces that view with a static three.js force graph of `public/brain-snapshot.json`. Unset or `BRAIN_TAB=0` leaves the slider. The shipped snapshot is the sample fixture. `node scripts/brain/export-snapshot.mjs` rewrites the snapshot from `docs/v2/v2-memory.jsonl` |
| Chat | `askAll`, then `speak`, then `silentPen` from `preview/src/lib/tessera` |
| Bus | `busStats` and `pullRecent` in `artifacts/api-server/src/lib/agi/agent-bus.ts` |
| Score | `artifacts/v2/src/brain/router-eval.json` report, `eval-os-metrics` live scores, and `chatbot-cases.ts` prompts |

`scripts/scorecard` and `evals/` are not in this tree. Score says so and lists `scripts/eval`, which holds the record writer rather than a stored pass count. Chatbot prompts are shown as cases, not as an invented score.

Syne (Bonjour Monde) and Fragment Mono (Wei Huang) are SIL Open Font License faces. The Syne license text is `public/fonts/OFL.txt`.

## Where this was left

The five preview marks and the web accent palette now use the same Next colors. The console does not replace `artifacts/tessera` routes. Chat falls through to the file pen when no local pen is configured. A full-graph time step recomputes co-mention synapses once per memory line and then caches that step in the process. The listen address stays `127.0.0.1` even if `HOST` or `TESSERA_CONSOLE_HOST` is set. Chat from curl needs the matching Origin header.
