---
name: GitHub owner account type
description: The vitalitychems-dot GitHub identity is a user account, which determines repository-creation endpoints.
---

`vitalitychems-dot` currently resolves as the authenticated GitHub `User` account. The organization repository endpoint returns 404; repository creation for this owner uses the authenticated-user endpoint.

**Why:** The organization endpoint failed even though repositories under the same login were visible; checking the account type identified the correct owner API.

**How to apply:** Verify the current account type and owner before creating repositories. Use the user or organization endpoint accordingly, and confirm the exact owner and repository name.