# Before you ask for a gate

Commit first. From the repo root run:

```bash
pnpm pregate
```

`node tools/pregate/run.mjs` is the same command.

The worktree must be clean. The command looks at every commit on this branch that is not already on `main`.

## What it checks

1. **Identity.** Every commit's author and committer are `vitalitychems-dot <332565808+vitalitychems-dot@users.noreply.github.com>`. The name and the email both have to match.
2. **Locked paths.** The diff does not touch rules (a `rules` directory, `.cursor/rules/`, or `.github/instructions/`), gate files under `scripts/` or `.github/`, `CODEOWNERS`, or workflow permissions (a new or deleted workflow, or a changed `permissions:` block).
3. **ENABLE flags.** A `TESSERA_ENABLE_*` name that is not on `main` and shows up in runtime source is off unless the value is exactly `1`. Names that appear only in tests, markdown, or `tools/pregate/` do not count. The commit messages can say that flag defaults on, and then this check allows it.
4. **Tests.** `pnpm test` passes.
5. **Secrets.** `gitleaks detect` on the commit range, when `gitleaks` is on `PATH`. If it is not installed, the check says so and does not fail the run.
6. **CLI argv.** For a changed wrapper that exports `runCli` (and can take a fake `spawnImpl` / `request`), an adversarial argv is run with the enable flag set to `1`. Unknown flags, `-f`, `-F`, `--field`, `--raw-field`, `--input`, `-H`, `--header`, `--jq`, `-q`, `-i`, `--include`, `--paginate`, and `-X` variants (`-X POST`, `-X get`, `-XGET`, `--method`, `--method=GET`, `-iX`, `-X GET` plus another flag) must be forwarded to the underlying command. A bare `graphql` and a `{owner}` / `{repo}` placeholder must be forwarded too. Handling that argv inside the wrapper, or spawning without those arguments, is a silent drop.

## When it passes

The last line is the comment to paste on the PR:

```text
ready for gate <full head sha>
```

Post that comment yourself. The command does not post it, and it does not merge.

## When it fails

It prints the failing check and does not print the ready line. Fix the branch, commit, and run it again before asking for a gate.
