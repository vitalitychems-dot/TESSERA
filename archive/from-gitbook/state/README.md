# Shared world model

This directory contains a small, Gitbook-owned, machine-readable snapshot of the coordination state for TESSERA.

It is **not** a runtime world model, causal model, autonomous control plane, or proof of AGI/consciousness. It records repository boundaries, goals, constraints, tasks, unknowns, and evidence so agents can orient from one pinned source.

## Files

- `world-model.schema.json` — structural contract.
- `world-model.json` — pinned snapshot of Gitbook and TESSERA.
- `validate_world_model.py` — standard-library validator.

## Validate

From the Gitbook root:

```bash
python3 state/validate_world_model.py
python3 -m json.tool state/world-model.json >/dev/null
python3 -m json.tool state/world-model.schema.json >/dev/null
```

## Refresh rules

Refresh the snapshot when the Gitbook or TESSERA base changes, a task claim/status changes, repository ownership changes, a policy changes, or a material unknown is resolved. Update the two full commit IDs and add evidence paths before changing a status from `PROPOSED`, `UNKNOWN`, or `BLOCKED`.

Do not include secrets, credentials, private runtime data, protected vault contents, absolute local paths, raw archive chunks, or unsupported capability claims. Keep implementation presence separate from evidence that a capability works.
