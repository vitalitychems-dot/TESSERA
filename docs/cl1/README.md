# CL1 lane — simulator summary (sanitized)

**Source:** local `/workspace/cl1-sim/` (no upstream README present; this is a sanitized summary of the sim-only workspace).  
**Status:** training / smoke in progress · **simulator only**.

## What this is

- Local **`cl-sdk`** simulator workspace for API-parity and Tessera biOS-lane prep.
- Official sim produces **non-learning control data** — not experimental biology.
- **Not** Cortical Cloud, **not** live CL1 hardware, **not** the Tessera pen.
- Live pen remains **xAI/Grok**. Tessera's pen is not the neurons.

## Layout (local box; not all files staged here)

| Path | Role |
|---|---|
| `smoke_test.py` | Short deterministic sim loop (accelerated time, fixed seed) |
| `smoke-result.json` | Last smoke outcome (pass/fail labels) |
| `traces/` | Simulator recordings (binary; do not commit secrets or credentials) |
| `bridge/`, `fixtures/` | Placeholders for future sim fixtures |

## Rules

- Flag any Tessera CL1/biOS integration **default OFF**.
- Do not wire CL1 into the pen slot.
- No secrets, no access-widget assumptions, never set `DATABASE_URL`.
- See `cl1-sim-prep.md` for the full checklist.

**Mark claims REPORTED until Build + Security mark TESTED.**
