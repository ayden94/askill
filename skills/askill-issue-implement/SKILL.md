---
name: askill-issue-implement
description: Implement one approved issue or fix confirmed blockers in the assigned worktree without remote writes.
---

# Implement one issue

Verify the approved contract and assigned worktree. Implement only the agreed scope. Return the exact checks, exit codes, observations, and anything not run. If a fix requires a scope change, stop and return to preflight.

If the assignment includes `convention`, read its index and the rules selected by the contract at the supplied `base_sha`. Apply that version, not an edited copy on the working branch.

The review target must be an identifiable local commit. Create it only with a local commit grant; otherwise wait for an authorized commit. Do not push, open a PR, merge, or grant a passing review.
