# mesh/drops: live_feed protocol

`live_feed.md` is the task board the **computer** lane (orchestrator) uses to hand work to
other lanes. Message routing still goes lane <-> tessera (`config/mesh-lanes.json`); this
file only records assignments.

## Owners (one owner per path, tesserav2 `docs/TOKEN-SAVING.md` section 3)
- `live_feed.md`: written only by **computer**. Everyone else reads.
- `status/<lane>.md`: written only by that lane (for example `status/storage.md`). Append a
  dated line when a task's status changes; computer folds it into `live_feed.md`.
- Two writers on one path: both stop and report to TESSERA, who names the sole writer.

## Entry format
Newest entries go at the top, under `## Tasks`. One entry per task:

```
### <YYYY-MM-DD> <id>  (example: 2026-10-21 LF-001)
- lane: <lane slug from config/mesh-lanes.json>
- owner bot: <bot name>
- task: <one sentence>
- inputs: <pointers: repo:path@sha, PR URL, line ranges>
- done-criteria: <checkable result: file, test, PR, number>
- status: open | in-progress | blocked (<reason>) | done (<evidence pointer>) | dropped (<reason>)
```

Rules: pointers, not pasted content; no secrets or endpoint URLs; label results REPORTED
(read) or TESTED (run). Keep each entry under about 10 lines.
