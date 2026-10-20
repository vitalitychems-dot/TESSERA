---
name: Rick proposal persistence tests
description: Isolate real API and browser review tests from shared Rick proposal state.
---

Run Rick persistence integration tests with a synthetic owner session and a unique proposal-state key enabled only under `NODE_ENV=test`. Seed a disposable proposal, exercise the real API route through the browser, verify the stored evidence, then delete and confirm only the synthetic state row is gone.

**Why:** Rick's normal proposal slate is a shared persisted document; owner actions update that document, so tests against the default key can modify real development data or become order-dependent.

**How to apply:** Set the test namespace before importing the proposal module, keep production credentials out of fixtures, and make cleanup assert the unique row no longer exists.
