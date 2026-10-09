---
name: GitHub connection collision
description: Replit reported a GitHub connector attachment conflict despite the visible connection status being not_added.
---

The GitHub integration directory reported a connection as `not_added`, but `addIntegration` rejected attaching it because another GitHub connection was already assigned to the Repl. A connection may also show `added` while its confirmed connector slug yields no sandbox connection because credentials are withheld. Neither mismatch justifies repeatedly reattaching or replacing the connection.

**Why:** The visible connector status may not expose the binding conflict, and a missing sandbox credential can reflect the execution context rather than an absent authorization. Disconnecting or replacing the connection could affect other connected apps.

**How to apply:** Check Replit's Integrations / Your integrations view for connection owner, scope, connected apps, and status. Use `listConnections` only when making an API call from a connection reported as `added`; if the exact slug still returns no usable connection, stop and have the owner or workspace admin resolve the binding/runtime access. Do not ask for tokens or loop through reconnect proposals.
