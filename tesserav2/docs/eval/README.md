# Eval entry points

These commands measure the tree that is already here. They do not call a homemade quiz MMLU, MMLU-Pro, GSM8K, or HumanEval. Industry scores stay unclaimed until a named external suite is run and its raw output is stored.

## Live API quiz

`artifacts/api-server/scripts/eval-chatbot.ts` sends the golden prompts in `artifacts/api-server/src/eval/chatbot-cases.ts` to a running API.

```bash
pnpm tsx artifacts/api-server/scripts/eval-chatbot.ts
```

`EVAL_BASE_URL` defaults to `http://localhost:5000`. Importing the case table does not run the quiz. The script runs `main()` only when it is the process entry point.

## Post-build suite

`artifacts/api-server` script `eval` runs the built CLI:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run eval
```

That is `node --enable-source-maps ./dist/cli/run-eval.mjs`. It needs the API build and a database because `src/lib/eval-runner.ts` imports `@workspace/db` and `runEvalSuite()` also runs database-backed System Health checks.

## Database-free System Health scoring

`src/lib/eval-os-metrics.ts` holds the four OS-metric checks from the suite: Process Heap Usage, CPU Load Average, OS Free Memory, and Process Uptime Stability. `src/__tests__/eval-runner-os-metrics.test.ts` covers their score branches without a database. The same functions stay on the suite list inside `eval-runner.ts`.

## Measured record

`scripts/eval/write-result.mjs` writes one JSON object:

`sha`, `date_ct`, `model`, `suite`, `n`, `pass`, `cost_usd`

`n`, `pass`, and `cost_usd` come from the caller. The writer does not fill them in. A suite name containing `mmlu` is refused.

```bash
node scripts/eval/write-result.mjs \
  --sha "$(git rev-parse HEAD)" \
  --model "<model name>" \
  --suite internal-quiz \
  --n 10 \
  --pass 7 \
  --cost-usd 0 \
  --out .local/eval-record.json
```

`date_ct` is America/Chicago unless `--date-ct` is passed.
