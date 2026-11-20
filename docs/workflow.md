# Workflow contracts

## State and authority

All runtime paths are relative to the target project root, not the askill installation.

| Record | Owns |
|---|---|
| `.askill/config.json` | Independent issue, PR, and ticket destinations; base branch and non-secret project policy |
| `.askill/intakes/<id>.json` | Agreed problem, exclusions, issue drafts, and approval scope |
| `.askill/issues/<id>.json` | Canonical ordered set of confirmed issue references from registration or read-only intake |
| `.askill/lanes/<id>.json` | Immutable source-bound plan, dependency reasons, retry policy, and explicit grants |
| `.askill/lanes-v4/<id>.json` | Execution facts, attempt counts, blockers, and references to accepted contracts and reviews |
| `.askill/work/<lane-id>/<issue-id>/` | Preflight, exact-head reviews, optional OCR and raw verification evidence |

Git and provider observations decide what currently exists. A ledger or UI status is not proof that a head, PR, or CI run still matches. Scope approval, issue creation, local commits, push, PR creation, merging, and cleanup have separate authorization boundaries.

## Lane loop

1. Import the exact planning ledger, binding its source digest. Reject an incompatible re-import rather than overwriting an existing run.
2. Observe the current issue, Git, and provider state. The pure decision engine derives one action from the execution ledger and those observations.
3. Dispatch the stage for that action. The lead validates its result and is the sole writer of shared lane state. Publish state atomically and serialize writers.
4. Replan from fresh observations. Independent issues can progress in separate worktrees. Do not treat file overlap as a semantic dependency.

Retries are bounded and preserve issue/worktree identity. Missing inputs, unconfigured tools, or unavailable independent reviewers are preparation failures, not product defects. Fix-back is for confirmed implementation or test blockers; material scope drift returns to preflight instead. A local-only lane terminates at the verified local head. A PR-enabled lane additionally follows the provider's current-head CI and separately granted publication, merge, and cleanup policy.

## Review evidence

Every mandatory verdict identifies the reviewer role, lane, issue, `base_sha`, `head_sha`, and accepted contract digest. The three roles are contract, code, and verification. Keep their results separate: `pass`, `block`, or `needs-evidence`. All three must pass at the same binding. No project documentation is required to start; no necessary evidence may be inferred from its absence.

An optional OCR receipt is not an axis verdict. Record `completed`, `skipped-uninstalled`, `skipped-not-authorized`, or `failed` against the same review binding. OCR failure is visible but does not turn a passing set of three required axes into a failed set. Confirmed defects, including findings first surfaced by OCR, still require fix-back and review of the new head.
