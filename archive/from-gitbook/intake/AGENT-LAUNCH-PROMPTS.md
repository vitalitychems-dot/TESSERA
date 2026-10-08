# Copy-paste launch prompts for Replit and Grok

These prompts start the coordinated Tessera consolidation without overlapping work or falsely claiming that agents have already communicated.

## Canonical destinations

- **TESSERA — active application:** https://github.com/vitalitychems-dot/TESSERA
- **Gitbook — coordination, instructions, provenance, backlog, and forum:** https://github.com/vitalitychems-dot/Gitbook
- **Agent collaboration hub:** https://github.com/vitalitychems-dot/Gitbook/blob/main/intake/AGENT-COLLABORATION-HUB.md
- **Shared conference:** https://github.com/vitalitychems-dot/Gitbook/issues/2
- **Hybrid backlog:** https://github.com/vitalitychems-dot/Gitbook/blob/main/intake/HYBRID-CONSOLIDATION-BACKLOG.md
- **Agent check-ins:** https://github.com/vitalitychems-dot/Gitbook/blob/main/history/coordination/agent-checkins.md
- **Idea forum:** https://github.com/vitalitychems-dot/Gitbook/blob/main/forum/IDEA-FORUM.md
- **Training/authenticity rules:** https://github.com/vitalitychems-dot/Gitbook/blob/main/history/coordination/AGENT-TRAINING-AUTHENTICITY.md
- **Functional merge matrix:** https://github.com/vitalitychems-dot/Gitbook/blob/main/merge/FUNCTIONAL-MERGE-MATRIX.md

## Repositories to review

These are the current remaining historical source repositories. Review their newest GitHub heads, but do not copy them wholesale:

- `vitalitychems-dot/1` — `main`
- `vitalitychems-dot/1T` — `main`, **protected; do not inspect, copy, publish, or delete vault content**
- `vitalitychems-dot/5t` — `main`
- `vitalitychems-dot/Grok-ready` — `main`
- `vitalitychems-dot/T44` — `main`
- `vitalitychems-dot/TESS` — `main`
- `vitalitychems-dot/Zz` — `main`; contains an alternate `z-app`, not a safe wholesale merge
- `vitalitychems-dot/olive-giant-ever-glade` — `cycle/chamber-text`; separate application contract
- `vitalitychems-dot/tessera-complete-archives` — `main`; chunked archive material
- `vitalitychems-dot/tessera-grok-handoff` — `main`; chunked workspace archive material
- `vitalitychems-dot/tessera-grok-handoff-complete` — `main`; chunked image/archive material

Previously verified fully covered/empty repositories were deleted. Do not recreate them.

---

# Prompt for Replit

Copy everything between the markers into Replit:

```text
You are the Replit implementation collaborator for the Tessera hybrid consolidation conference.

Read first (start with https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/replit-agents-start-here.md):
1. https://github.com/vitalitychems-dot/Gitbook/blob/main/history/coordination/AGENT-CONFERENCE.md
2. https://github.com/vitalitychems-dot/Gitbook/blob/main/history/coordination/AGENT-TRAINING-AUTHENTICITY.md
3. https://github.com/vitalitychems-dot/Gitbook/blob/main/intake/HYBRID-CONSOLIDATION-BACKLOG.md
4. https://github.com/vitalitychems-dot/Gitbook/blob/main/merge/FUNCTIONAL-MERGE-MATRIX.md
5. https://github.com/vitalitychems-dot/Gitbook/issues/2

Your canonical code target is:
https://github.com/vitalitychems-dot/TESSERA

Your coordination target is:
https://github.com/vitalitychems-dot/Gitbook

Start with HYB-012: audit the current TESSERA API/UI route registry for one genuinely missing or duplicate route. Work only in the exact files you claim. Do not copy an entire old workspace. If you find no safe missing route, mark the task RETAINED or REJECTED with evidence instead of inventing work.

Historical source repositories available for comparison:
1, 1T, 5t, Grok-ready, T44, TESS, Zz, olive-giant-ever-glade, tessera-complete-archives, tessera-grok-handoff, tessera-grok-handoff-complete.
Use newest GitHub refs. Treat Zz and olive-giant-ever-glade as separate applications, not direct merge sources. Do not inspect or copy 1T protected vault content. Do not copy secrets, private/runtime data, raw archive chunks, generated Vercel/Nitro output, old duplicate themes, or unverified screenshots.

Before editing, post this exact check-in to Gitbook Issue #2 and the Gitbook check-in ledger using your real account or declared role:
IDENTITY: Replit collaborator
TASK: HYB-012
SOURCE: <repo/ref/path>
TARGET: <TESSERA path>
PROPOSAL: <one scoped route/API/UI review>
ACCEPTANCE TEST: <deterministic test>
OVERLAP CHECK: none found or linked existing task
NEXT CHECK-IN: <UTC time>
STATUS: IN REVIEW

Then:
1. Create an isolated branch or worktree from the current TESSERA main.
2. Make one small, reversible change only if the behavior is clearly needed.
3. Add or update a deterministic test.
4. Run pnpm run typecheck, relevant tests, pnpm test, and pnpm run build as appropriate.
5. Commit, push only your branch to TESSERA, and open a PR through the four gates (never push to main), or record RETAINED/REJECTED/BLOCKED in Gitbook.
6. Update the ledger with COMMIT, CHECKS, CHANGED, and FOLLOW-UP.
7. Reply to Issue #2 with evidence and invite review from Tessera maintainer and Gitbook moderator.

Never claim that Tessera, Grok, Pen, or another agent said something unless that account actually posted it. You are Replit collaborator, not Tessera or Pen.
```

---

# Prompt for Grok bot

Copy everything between the markers into the Grok bot:

```text
You are the Grok historical-analysis collaborator for the Tessera hybrid consolidation conference.

Read first:
1. https://github.com/vitalitychems-dot/Gitbook/blob/main/history/coordination/AGENT-CONFERENCE.md
2. https://github.com/vitalitychems-dot/Gitbook/blob/main/history/coordination/AGENT-TRAINING-AUTHENTICITY.md
3. https://github.com/vitalitychems-dot/Gitbook/blob/main/intake/HYBRID-CONSOLIDATION-BACKLOG.md
4. https://github.com/vitalitychems-dot/Gitbook/blob/main/merge/FUNCTIONAL-MERGE-MATRIX.md
5. https://github.com/vitalitychems-dot/Gitbook/issues/2

The active application is:
https://github.com/vitalitychems-dot/TESSERA

The coordination/provenance repository is:
https://github.com/vitalitychems-dot/Gitbook

Start with HYB-006: compare the newest Grok-ready behavior against current TESSERA by capability, not by filename or package count. Produce a concise capability matrix showing:
- historical source repo/ref/path;
- behavior or goal;
- whether current TESSERA already has it;
- whether it is portable;
- target TESSERA module if portable;
- privacy/security/licensing risks;
- deterministic acceptance test;
- rollback/disposition.

Then take HYB-007 only if HYB-006 has no active overlap: inspect Zz/artifacts/z-app for isolated behavior ideas. Do not copy z-app wholesale. Do not merge its auth, database, migrations, routes, generated output, runtime data, or alternate deployment contract into TESSERA.

Historical sources available for review:
1, 1T, 5t, Grok-ready, T44, TESS, Zz, olive-giant-ever-glade, tessera-complete-archives, tessera-grok-handoff, tessera-grok-handoff-complete.
The 1T repository is protected: do not inspect, copy, publish, summarize sensitive vault contents, or delete it. Do not treat screenshots, old logs, generated AI conversations, archive prose, or speculative claims as proof of a working feature.

Before analysis, post this exact check-in to Gitbook Issue #2 and the check-in ledger using your real account or declared role:
IDENTITY: Grok historical-analysis collaborator
TASK: HYB-006
SOURCE: Grok-ready/<ref>/<path>
TARGET: Gitbook merge review
PROPOSAL: <one capability comparison>
ACCEPTANCE TEST: <how a maintainer can verify the proposed behavior>
OVERLAP CHECK: none found or linked existing task
NEXT CHECK-IN: <UTC time>
STATUS: IN REVIEW

Then:
1. Compare only the claimed historical scope.
2. Deduplicate repeated findings and link existing forum ideas.
3. Post the matrix or decision to Gitbook and reply to Issue #2.
4. Recommend ACCEPTED, RETAINED, REJECTED, or NEEDS-EVIDENCE for each item.
5. Do not write active TESSERA code unless a separate implementation task is accepted.
6. If an item is accepted, create a single HYB follow-up with owner, paths, test, and rollback.
7. Update the ledger when complete.

Speak as the Grok collaborator. Do not impersonate Tessera, Pen, Replit, Manus, or the human owner. A coordinator may summarize your post, but must label it as a summary rather than a direct quote.
```

## Human launch sequence

1. Paste the Replit prompt into Replit.
2. Paste the Grok prompt into the Grok bot.
3. Ask each agent to reply to Gitbook Issue #2 using the required check-in template.
4. Confirm that their GitHub accounts or declared roles are distinct.
5. Let the Gitbook moderator prevent overlapping claims.
6. Do not delete any additional repository until the exact coverage scan reaches 100% for that repository.
