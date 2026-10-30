# Trusted catalogue check: documentation-only smoke test (31/10/2026)

This file exists only to open a harmless, documentation-only draft pull request. The pull request is a **temporary security-infrastructure smoke test and is not intended for merging**.

## Purpose

Confirm that the `catalogue-publication-trusted` job in `.github/workflows/catalogue-publication-trusted.yml` (`pull_request_target`) runs, accepts a pull request that changes no catalogue price files, and reports a check that can be inspected. The test establishes that the workflow executes. It does not establish that unsafe merges are blocked, and it does not change which checks are required on `main`.

## Test parameters

| Item | Value |
| --- | --- |
| Base commit | `310fb8210d0df7ea27dfdbe0605a10182c5ca0e2` (merge of PR #44) |
| Test branch | `test/catalogue-trusted-check-docs-smoke-20261031` |
| Target branch | `main` |
| Pull request state | Draft, not to be merged |

## What this change does not touch

- No catalogue prices or other catalogue data are modified.
- No signing keys are registered; the researcher and approver registries stay empty.
- No approval evidence is added or changed.
- No workflows, Actions policies or branch protection settings are modified.
- No application code or scripts are modified.

The only change is this Markdown file. The pull request should be closed without merging once the trusted workflow results have been recorded.
