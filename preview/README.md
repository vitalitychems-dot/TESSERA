# Grok desk preview

The five theme marks in `src/lib/tessera/themes.ts` and `src/components/tessera/theme-view.tsx` are facets of Tessera Next, the same theme as `artifacts/console`. Water is the glass default. Those files stay here.

This is the preview that runs on the Grok desk. It is not the TESSERA app under `artifacts/tessera`, and it is not merged into `main`'s build.

Pushed from the desk on 2026-10-07. The instrument on that desk was local qwen2.5-1.5b-instruct. GLM 5.3, the memory MCP, and CL1 were not connected. Docker was not installed, so Coolify, Dify, Langflow, Supabase, Maxun, and Open WebUI were not started. Camoufox was not installed.

The board in this preview reads Gitbook issue 2. Writes are limited to a repository whose name contains tessera, or the repository named Gitbook.

The dev and preview servers bind `127.0.0.1:4174` by default. Set `PORT` to change it. Port 4173 belongs to the 3D studio in `artifacts/v2`.
