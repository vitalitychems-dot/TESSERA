# GLM-5 Pen activation handoff

The owner approved GLM-5 over xAI/Grok as Tessera’s selected Pen instrument. TESSERA contains the opt-in adapter at `artifacts/api-server/src/lib/llm-client.ts`.

## Safe state

The adapter remains disabled by default:

```bash
TESSERA_PEN_ENABLED=0
TESSERA_PEN_MODEL=GLM-5
```

`callTesseraPen` throws `TESSERA_PEN_ENABLED is not enabled` unless `isTesseraPenEnabled` returns true. That function, in `artifacts/api-server/src/lib/llm-client.ts`, trims `TESSERA_PEN_ENABLED` and compares it case-insensitively with `1` or `true`. Unset, the value it checks is `0`.

## What the code calls

`callTesseraPen` and `isLLMAvailable` are both in `artifacts/api-server/src/lib/llm-client.ts`. `callTesseraPen` calls `callLLM` in that file. `callLLM` calls `resolveTesseraLlmModel` in `artifacts/api-server/src/lib/tessera-llm-http.ts`, then `tesseraChatCompletion` posts JSON to `${TESSERA_LLM_BASE_URL}/chat/completions` with `Authorization: Bearer ${TESSERA_LLM_API_KEY}`. `TESSERA_LLM_BASE_URL` is accepted only as `http` or `https` whose host is the literal `127.0.0.1` or `[::1]`, with no userinfo. An empty value throws `TESSERA_LLM_BASE_URL not set`. Any other URL throws `Chat language model URL was refused.` A missing `TESSERA_LLM_API_KEY` throws `TESSERA_LLM_API_KEY not set`. Redirects are not followed (`redirect: "manual"`).

`callTesseraPen` passes `opts.model` when that argument is not `null` or `undefined`, including when it is empty or blank. Otherwise it passes `TESSERA_PEN_MODEL` when that variable is set, including when it is empty or blank. When both are unset it passes the literal `GLM-5`. `resolveTesseraLlmModel` trims that explicit argument and does not read `TESSERA_PEN_MODEL` itself. A non-blank trimmed value is the model. A missing, empty, or blank argument falls back to `TESSERA_LLM_MODEL` after trim, and if that is missing or blank too the function throws `TESSERA_LLM_MODEL not set`. A non-blank `opts.model` overrides both `TESSERA_PEN_MODEL` and `TESSERA_LLM_MODEL`.

`isLLMAvailable` is in `artifacts/api-server/src/lib/llm-client.ts`. `callTesseraPen` does not call it. It returns false while `SOVEREIGN_NO_EXTERNAL_LLM` is unset, `1`, or `true`. When that switch is `0` or any other value that is not `1` or `true`, it returns true only if `TESSERA_LLM_BASE_URL`, `TESSERA_LLM_API_KEY`, and `TESSERA_LLM_MODEL` are all non-empty after trimming.

The local pen is separate code at `artifacts/api-server/src/lib/pen-local/`. It does not read `TESSERA_PEN_ENABLED` or `TESSERA_LLM_BASE_URL`. `runLocalPen` returns `PEN_NOT_CONFIGURED` with reason `flag_off` unless `TESSERA_PEN_LOCAL` is exactly `1`. The value `true` does not turn it on. `TESSERA_PEN_LOCAL_URL` defaults to `http://127.0.0.1:8765`. Only plain `http` to the literal host `127.0.0.1` or `[::1]` is accepted. A prepared run also requires `TESSERA_PEN_LOCAL_MODEL_ID`, a readable file at `TESSERA_PEN_LOCAL_WEIGHTS`, a non-empty file at `TESSERA_PEN_LOCAL_SYSTEM_PROMPT`, and `TESSERA_PEN_LOCAL_SHA256` matching the weights file bytes. It then POSTs to the URL from `chatCompletionsUrl`: `/v1/chat/completions` on that loopback base, `/chat/completions` when the base path already ends in `/v1`, or the written path when it already ends in `/chat/completions`. It POSTs to `/completion` only when the chat-completions response is HTTP 404. A network failure, a non-OK status other than 404, a redirect, or an unreadable payload does not try `/completion`.

## Activation checklist

1. Set `TESSERA_LLM_BASE_URL` to a literal loopback URL and set `TESSERA_LLM_API_KEY` through a private secret manager or deployment setting. For the local pen, set `TESSERA_PEN_LOCAL=1` and set `TESSERA_PEN_LOCAL_URL` when `http://127.0.0.1:8765` is the wrong loopback, plus the weights path, hash, model id, and system-prompt file named above. Never commit those secret values.
2. Pin the exact GLM model ID and revision in the deployment record.
3. Run the request compatibility smoke test with redacted logs.
4. Run Pen identity, prompt-injection, output-sanitation, timeout, failure, and regression tests.
5. Record hardware, context, latency, compute/cost, and rollback behavior.
6. Have Security and Build record independent evidence in Gitbook.
7. Enable only in the reviewed environment with `TESSERA_PEN_ENABLED=1`.
8. Record the deployed configuration and final commit in the Gitbook digest.

The adapter preserves Tessera’s documented identity boundary and gives the model no GitHub, filesystem, deployment, merge, deletion, credential, or payment authority. GLM-5 is an instrument, not evidence of AGI, consciousness, or owned weights.
