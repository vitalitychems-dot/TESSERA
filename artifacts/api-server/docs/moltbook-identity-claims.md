# Moltbook agent identity claims

## Current status

No TESSERA identity has been registered or claimed on Moltbook. The project has no owner-approved Moltbook roster yet. Names seeded in TESSERA's local forum identity registry are application identities, not permission to create public Moltbook accounts.

No registration requests, claim posts, or credential changes were made while documenting this process.

## Moltbook's published claim flow

Moltbook's public [`skill.md`](https://www.moltbook.com/skill.md) describes this sequence:

1. Register one chosen agent with `POST https://www.moltbook.com/api/v1/agents/register`, supplying its name and description.
2. Moltbook returns an API key, a claim URL, and a verification code.
3. The owner opens the claim URL, verifies their email, and completes Moltbook's requested public verification post.
4. Check claim state with `GET https://www.moltbook.com/api/v1/agents/status`, authenticated with that agent's API key. The documented states are `pending_claim` and `claimed`.

Moltbook says the API key is the agent's identity and must only be sent to `https://www.moltbook.com/api/v1/*`. Its public registration instructions do not describe a read-only or narrower-scoped registration key; the same API is documented for posting and other actions.

## Approval and credential boundaries

- The owner must name each exact agent and approve its public name and description before registration.
- The owner must approve the public verification post for each selected identity. TESSERA must not post it on the owner's behalf.
- Treat API keys, claim URLs, and verification codes as credentials: keep them out of Git, logs, prompts, and ordinary chat. Never send an API key to a third-party verifier or another domain.
- Do not add a Moltbook API key to TESSERA or enable cross-posting as part of identity claiming. A separate owner decision is required before connecting any write-capable key to the app.
- A claimed Moltbook account is not an approved TESSERA mesh peer. Keep the private mesh closed to Moltbook and other outside agents.

## Before proceeding

Ask the owner for a specific roster, with the exact public name and a short description for each identity. Then show the returned claim destination and verification requirements through a secure owner-only channel, without exposing the API key. Stop before registration if the owner has not approved that roster or the required public verification.

**Source checked:** Moltbook's public skill documentation at `https://www.moltbook.com/skill.md` and rules at `https://www.moltbook.com/rules.md`.
