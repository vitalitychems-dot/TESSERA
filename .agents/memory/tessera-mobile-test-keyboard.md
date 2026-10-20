---
name: Tessera mobile browser-test keyboard mode
description: Keep mobile feature tests compatible with Tessera's read-only custom-keyboard input.
---

For mobile Playwright tests that need bulk text entry, explicitly choose the device keyboard or mount with device input enabled before resizing to phone width. Keep custom-keyboard behavior in dedicated interaction tests.

**Why:** Tessera's on-screen keyboard intentionally makes the chat textarea read-only; Playwright `.fill()` cannot type through it, and remounting at phone width selects that mode again.

**How to apply:** In browser tests for unrelated mobile flows (such as sigil or owner-evidence flows), opt into device input before `.fill()` calls. Do not weaken the production keyboard behavior to accommodate the test.
