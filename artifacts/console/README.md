# Tessera console

Phosphor lattice is the current Tessera UI. It is one Node process on **127.0.0.1:4391**.

```bash
pnpm --filter @workspace/console run dev
```

`TESSERA_CONSOLE_PORT` overrides the port. `TESSERA_CONSOLE_MEMORY` overrides the gitignored retrieval-memory directory (default `.local/tessera-console-memory`). This app does not read or set `TESSERA_ENABLE_*`.

| Tab | Real source |
| --- | --- |
| Eye | Tail of `docs/v2/v2-memory.jsonl`, the in-process agent bus, and retrieval-memory rows written by Chat |
| Brain | `loadGraph` / `replayAt` / Hebbian synapses on that same memory log, with a time slider |
| Chat | `askAll`, then `speak`, then `silentPen` from `preview/src/lib/tessera` |
| Bus | `busStats` and `pullRecent` in `artifacts/api-server/src/lib/agi/agent-bus.ts` |
| Score | `artifacts/v2/src/brain/router-eval.json` report, `eval-os-metrics` live scores, and `chatbot-cases.ts` prompts |

`scripts/scorecard` and `evals/` are not in this tree. Score says so and lists `scripts/eval`, which holds the record writer rather than a stored pass count. Chatbot prompts are shown as cases, not as an invented score.

Syne (Bonjour Monde) and Fragment Mono (Wei Huang) are SIL Open Font License faces. The Syne license text is `public/fonts/OFL.txt`.

## Where this was left

The older water/fire/lightning/diamond/spiral marks and the tessera accent palette are still on disk and marked superseded in the root README. The console does not replace `artifacts/tessera` routes. Chat falls through to the file pen when no local pen is configured. A full-graph time step recomputes co-mention synapses once per memory line and then caches that step in the process.
