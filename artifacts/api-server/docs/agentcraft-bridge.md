# AgentCraft read-only bridge

This connects a running AgentCraft Foreman to TESSERA’s owner-only world panel. It does **not** expose AgentCraft’s WebSocket to a browser or send commands to Foreman.

## What is and is not shown

- The connector reads the Foreman’s loopback WebSocket and sends only backend (`sim`, `claude`, or `codex`) and each agent’s id, display name, state, station, and active flag.
- It discards logs, messages, task descriptions, repository names and paths, branches, worktree paths, diffs, credentials, and all command/control messages.
- The panel is a station diagram, not a Minecraft client view. The Foreman feed does not provide game coordinates or prove that a Minecraft client is currently open.
- If the connector stops sending heartbeats for 60 seconds, the API reports the last snapshot as stale. If none has arrived, it reports unavailable.

## Configure

1. In Replit Secrets, set `AGENTCRAFT_BRIDGE_TOKEN` to a newly generated random value of at least 32 characters. Do not reuse `TESSERACT_ADMIN_KEY` or a GitHub token. The value is used only by the bridge and the API; never put it in source control or the browser.
2. On the machine running AgentCraft Foreman, set the same token in its environment and set `TESSERA_AGENTCRAFT_INGEST_URL` to the TESSERA API URL ending in `/api/world/agentcraft/ingest`.
3. From the TESSERA workspace, run the connector on that same machine:

   ```sh
   node artifacts/api-server/scripts/agentcraft-readonly-bridge.mjs
   ```

   It connects only to `ws://127.0.0.1:7878` by default. `AGENTCRAFT_FOREMAN_URL` may select a different loopback port; non-loopback hosts and insecure non-local ingest URLs are rejected.
4. Sign in to TESSERA and open the World panel. It polls the owner-protected `/api/world/agentcraft` endpoint every 15 seconds.

The API returns `503 bridge-unconfigured` for ingestion until its separate bridge token is set. This is expected and fail-closed. The bridge logs status codes only and never logs the token or forwarded payload.

## Operational limits

- Maximum 32 agents, 24 KiB request body, 60 ingest requests per minute per ephemeral HMAC-pseudonymized IP bucket.
- The API keeps only the latest snapshot in memory; an API restart clears it and the panel remains unavailable until the local bridge reconnects.
- AgentCraft’s `sim` backend is explicitly labeled as simulation; it is not reported as autonomous live work.
