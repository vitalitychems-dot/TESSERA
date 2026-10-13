# Reasoning eval

Exact-match accuracy on a fixed 200-item slice of the public GSM8K test split. The number is a task score for this file. It is not an IQ score.

## Dataset

| Field | Value |
| --- | --- |
| Set | GSM8K (Grade School Math 8K) |
| Upstream | https://github.com/openai/grade-school-math |
| Commit | `3101c7d5072418e28b9008a6636bde82a006892c` (2021-11-19) |
| License | MIT, Copyright (c) 2021 OpenAI. Full text in `LICENSE`. |
| Split | `grade_school_math/data/test.jsonl` (1319 lines) |
| Split sha256 | `3730d312f6e3440559ace48831e51066acaca737f6eabec99bccb9e4b3c39d14` |
| Subset | First 200 lines, file order, indices 0–199. Vendored as `gsm8k-test-200.jsonl`. |
| Subset sha256 | `bd70035c7acaf107b4e0d077c605a23c3d3a0acb4342e5bc60099e6ad9ff4284` |

The problems were not written for this repo. `SOURCE.json` is the record the runner checks. A hash mismatch refuses to score.

## Local model

The runner calls the Ollama path already implemented by `OllamaAdapter` in `artifacts/api-server/src/lib/local-model-manager.ts`:

- `OLLAMA_ENDPOINT` (default `http://localhost:11434`)
- `GET /api/tags`
- `POST /api/chat` with `stream: false`, `options.num_predict` (512), `options.temperature`
- Model: `OLLAMA_MODEL` if set and pulled, otherwise the first of `llama3.2:3b`, `llama3.2:1b`, `mistral:7b`, `phi3:mini`, otherwise the first pulled tag

Eval requests send `temperature: 0`. The adapter's chat default of 0.7 is unchanged.

No other runtime is called. If the tags check fails, or no model is pulled, or every chat call errors, the process prints `status: "model-unavailable"`, `accuracy: null`, and exits 2. It does not fill in a score.

## Run

From `artifacts/v2`:

```bash
node eval/reasoning/run.mjs --dry-run
node eval/reasoning/run.mjs
node eval/reasoning/run.mjs --model llama3.2:3b --out /tmp/gsm8k-200.json
```

`--limit N` scores a prefix of the same fixed file (a smoke run). The default scores all 200. `--dry-run` checks the vendored file and does not contact a model.

`pnpm --dir artifacts/v2 test` covers loading, scoring, and the unavailable path. It does not require Ollama.

## Prompt

One prompt is shipped: `baseline-v1` in `prompt.mjs`. It asks for steps and a final `#### <number>` line, which is the GSM8K gold format.

No local model was available when this runner was added (`ollama` was not installed, and nothing was listening on port 11434). No accuracy was measured, so no second prompt was kept. A later prompt change needs a before/after exact-match on this same 200-item file from a live local model. Drop the change if it does not beat `baseline-v1` on that run.

## Score

Gold is the number after the final `####` in the dataset answer. The prediction is the last `####` number in the model reply, or the last number if the reply has no `####`. Commas are ignored, and `18.0` matches `18`. The report field is `exact_match_accuracy` (`correct / n`).
