# Saving Actions minutes and agent tokens

Batch work before it reaches GitHub. Each push to a pull request starts the required checks again.

## Before you push

- Put the change in as few commits as you can, then push once. Do not push after every commit just to see CI.
- Run `pnpm test` locally before pushing. CI runs that same command.
- Run gitleaks locally before pushing. Install the pinned binary with `sh scripts/install-gitleaks.sh`, then `node scripts/gitleaks-scan.mjs`. A finding fails the command. The script prints file, line, and rule id.
- Do not push an empty commit, a rebase, or a repeat of the same tree only to retrigger CI. If a run is queued because Actions minutes are used up, another push starts another set of jobs.

`validate` and `gitleaks` also run on a push to `main`. A pull request into `main` runs `validate`, `gitleaks`, `diff-scan`, `author-check`, `ready-for-gate`, and `collect`.

## October 2026, latest 1000 runs

These figures are an estimate. They are wall-clock minutes from the latest 1000 workflow runs, so they are a lower bound on billed minutes (GitHub rounds each job up, and other operating systems use a multiplier). Linux jobs in this repository are ×1.

| Workflow | Wall minutes | Runs |
| --- | --- | --- |
| CI on pull requests | 855 | 178 |
| Pull request gates | 477 | |
| Secret scan on pull requests | 462 | |
| moderator-lock | 282 | 265 |
| CI on push | 340 | |
| Secret scan on push | 134 | |
| Scheduled workflows | about 5 | |

That pull-request CI row is about 4.8 wall minutes per run before the gates, the secret scan, and the lock. A second push while those are still going pays for another set.
