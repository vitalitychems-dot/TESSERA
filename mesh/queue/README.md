# Task queue mirror

Cloud agents on TESSERA cannot read the private Gitbook repository. `TASKS.mirror.json` is a read-only copy of Gitbook `mesh/queue/TASKS.json`. The `source` field records which snapshot was copied.

**Claims still happen in Gitbook.** To claim a task, set `status` to `claimed`, plus `claimed_by`, `claimed_at`, and `claim_lock=<agent>:<gitbook_main_sha>`, in one commit to Gitbook `main` via a pull request. Editing this mirror does not claim a task. A claim older than 6 hours with no pull request is stale and may be re-queued. One task per cloud agent, one branch per task. Two tasks must not touch the same scope at once.

Check the mirror before using it:

```sh
node scripts/check-task-mirror.mjs
```

The checker requires unique task ids, a `status` of `queued`, `claimed`, `blocked`, or `done`, and a `scope` array of non-empty strings on every task. It exits non-zero when the file is missing, not valid JSON, or fails those checks.

Refresh the mirror by copying Gitbook `mesh/queue/TASKS.json` and keeping the `source` header. Do not add or claim tasks in this file.
