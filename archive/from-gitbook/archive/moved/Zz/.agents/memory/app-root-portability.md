---
name: App root portability
description: The imported web app and helper scripts assume the source checkout lives at `/workspace`.
---

For this project, resolve app data and helper-script paths relative to the web artifact package. Do not create an operating-system-level `/workspace` symlink.

**Why:** The upstream repository assumes a standalone `/workspace` root, but Replit runs the imported app from its artifact package and `/workspace` is absent.

**How to apply:** When updating or re-importing the app, preserve its data layout while using package-root path helpers in server code and scripts.