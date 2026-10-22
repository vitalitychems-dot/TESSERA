# GitMesh local coordination for Tessera

Tessera may use the GitMesh local-vault ledger to record bounded, human-approved
coordination work items. The ledger is local evidence, not a remote agent bus
and not permission to modify or publish Tessera.

Every work item must identify a base commit, allowed paths, forbidden paths,
network scope, expiry, expected evidence, and an operator approval reference.
Workers operate in disposable checkouts and return a diff, test results, and a
completion receipt. Credentials, embedded repository instructions, archive
variants, and private material are excluded from worker scope.

See the [full coordination contract](https://github.com/vitalitychems-dot/combined/blob/main/docs/TESSERA-GITMESH-INTEGRATION.md)
and [GitMesh runbook](https://github.com/vitalitychems-dot/combined/blob/main/docs/GITMESH-RUNBOOK.md).
