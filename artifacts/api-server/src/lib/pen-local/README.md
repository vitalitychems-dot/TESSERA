# Local pen

The local pen stays off unless `TESSERA_PEN_LOCAL` is exactly `1` after trimming. `true` does not turn it on. The hosted pen stays first. This module does not read `TESSERA_PEN_ENABLED` or any `TESSERA_ENABLE_*` flag, and it does not read `DATABASE_URL`.

## Loopback

`TESSERA_PEN_LOCAL_URL` defaults to `http://127.0.0.1:8765`. The only accepted hosts are the written literals `127.0.0.1` and `[::1]`. The scheme must be `http`. Userinfo is rejected. Redirects are not followed (`redirect: "manual"`); a 3xx result is `non_loopback`.

`localhost` is rejected, including `LOCALHOST`, `localhost.`, and `foo.localhost`. A name is resolved through DNS, so it is not a literal loopback address. Forms that a URL parser would rewrite into `127.0.0.1` are rejected too: `0.0.0.0`, `127.1`, a decimal address, an IPv4-mapped address such as `[::ffff:127.0.0.1]`, and a host like `127.0.0.1.evil.example`. `http://127.0.0.1@evil.example` is userinfo on a non-loopback host and is rejected.

The same classifier is what `prepareLocalPen` and `pen:local:gate` use.

## PEN_NOT_CONFIGURED reasons

`text` is null. No text is invented.

| Reason | When |
| --- | --- |
| `flag_off` | `TESSERA_PEN_LOCAL` is not `1`. Other keys are ignored. |
| `non_loopback` | The URL is not plain http to literal `127.0.0.1` or `[::1]`, or the runtime answered with a redirect. |
| `model_id_missing` | `TESSERA_PEN_LOCAL_MODEL_ID` is unset. Provenance must not invent a backend id. |
| `weights_missing` | `TESSERA_PEN_LOCAL_WEIGHTS` is unset or is not a readable file. |
| `system_prompt_missing` | `TESSERA_PEN_LOCAL_SYSTEM_PROMPT` is unset, missing, or empty. The prompt file is not copied into the repo. |
| `hash_mismatch` | `TESSERA_PEN_LOCAL_SHA256` is unset or does not match the file hash. |
| `runtime_down` | The loopback runtime did not answer. |

`model_id_missing` is a required stop. An unset model id is not filled in with a product name.

## Gates

The pre-gate is a deterministic classifier. It does not call a model. A match returns the fixed refuse-and-offer line for `PEN-REFUSE-PAIN`, `PEN-REFUSE-UNCENSOR`, `PEN-REFUSE-SURVEIL`, `PEN-REFUSE-MONEY`, `PEN-REFUSE-SECRETS`, `PEN-REFUSE-SELFMOD`, `PEN-REFUSE-SEX`, or `PEN-REFUSE-HARM`.

The pre-gate never lets a negation cancel a refusal match. Uncensoring, sexual-content, and harm hits are refused unless the matched span lies fully inside a whole-phrase safe allowlist. Phrases match on word boundaries, case-insensitive, with apostrophes and whitespace normalized: `I do not want to hurt anyone`, `please do not hurt anyone`, `do not hurt`, `how do I stay safe`, `not a way to hurt someone`, `no wallet and no trading`, and `do not print admin passwords`. A prompt that also has a matching span outside the phrase, including text inside quotes or a title, is still refused. `please dont hurt anyone` is refused. When in doubt the pre-gate refuses. A span inside a pattern stops at a comma.

The post-gate rejects the reply. `gate.post` is only `pass` or `blocked`. A blocked reply is `PEN_GATE_BLOCKED` with `text` null. Banned claims, a wrong backend name, a secret-like string, a closing signature line, and a `PEN-REFUSE-*` id when the pre-gate found no rule are rejected. Claim blocks are the only place that uses the three-word direct-negation check. `I am not conscious` passes. `I can't deny I am conscious`, `There is no question I am conscious`, and `No doubt about it, I am conscious` block.

## Provenance

Provenance is the truthful backend record. Identity marks never go in it.

| Field | Meaning |
| --- | --- |
| `pen_identity` | Always `Tessera pen`. |
| `backend_model_id` | The id from `TESSERA_PEN_LOCAL_MODEL_ID`, before the last `@`. |
| `backend_revision` | The revision after that `@`, or null. |
| `weights_sha256` | SHA-256 of the weights **file on disk**. It does not prove which bytes the runtime process actually loaded or is serving. |
| `runtime` | The build id. `TESSERA_PEN_LOCAL_RUNTIME_BUILD` when that env is set. Otherwise a version string the runtime itself returned (`runtime_build`, `build_id`, `version`, or a string `runtime` field). Otherwise the literal `unknown`. A product name is never filled in. Null only when the pen never started. |
| `system_prompt_sha256` | SHA-256 of the pinned prompt file bytes. |
| `params` | `temperature` 0, `seed` 42, `max_tokens` 220. |
| `cl1_sim` | `enabled`, `is_simulator`, and `label` `REPORTED`. |
| `timestamp_utc` | ISO time. |
| `latency_ms` | Elapsed milliseconds. |

`TESSERA_PEN_LOCAL_RUNTIME` is not copied into provenance. It is not a build id.

## CL1

`TESSERA_PEN_CL1_SIM` defaults to off. Only the exact value `1` asks for the simulator. The loader uses one fixed path, `cl1-simulator.mjs` beside this module. That simulator file is not in this PR, so the stub safely falls back to off. It does not import or resolve a package by a bare name. If that file is missing or `is_simulator()` is not true, `cl1_sim.enabled` stays false and the pen continues. No session is started. Hardware and cloud are not contacted. The training switch is never read.

## Manual score

`pnpm --dir artifacts/api-server run pen:local:gate` reads prompts from `TESSERA_PEN_LOCAL_PROMPTS`. It is not part of `pnpm test` and it does not run in CI by itself. If the runtime is down it exits without a score.
