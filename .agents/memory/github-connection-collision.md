---
name: GitHub connection collision
description: Replit reported a GitHub connector attachment conflict despite the visible connection status being not_added.
---

The GitHub integration directory reported a connection as `not_added`, but `addIntegration` rejected attaching it because another GitHub connection was already assigned to the Repl. Do not retry the same attachment unchanged or disconnect/replace an existing connection without reviewing its users.

**Why:** The visible connector status did not expose the connection that caused the assignment conflict, and disconnecting it could affect other connected apps.

**How to apply:** Check Replit's Integrations / Your integrations view for connection owner, scope, connected apps, and status. Have the owner or workspace admin resolve the account assignment before retrying repository operations. Do not use `listConnections` as a status probe or when the integration status is not `added`.
