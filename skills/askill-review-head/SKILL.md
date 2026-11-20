---
name: askill-review-head
description: Review one exact head with three independent mandatory axes and optional installed Open Code Review.
---

# Review an exact head

The lead compares the actual diff with the approved contract and gives three independent, read-only reviewers the same base SHA, head SHA, contract digest, diff, and verification evidence. The implementer cannot independently approve their own work.

| Reviewer | Question |
| --- | --- |
| [Contract](references/contract.md) | Does the change meet its requirements, preserve the agreed behavior, and stay in scope? |
| [Code quality](references/code.md) | Is the change correct at its actual call sites, consistent with local rules, and free of identified regressions? |
| [Verification](references/verification.md) | Do the recorded runs and observations demonstrate each acceptance criterion? |

Give each reviewer only their own role guide. Do not assign the three roles sequentially to one worker. If the assignment includes `convention`, each reviewer reads the index and relevant rules at the supplied `base_sha`. The code reviewer cites the rule, changed location, and impact of each violation. Edits to conventions on the working branch do not change the review standard.

Call `askill run-ocr` with the same binding during review. Open Code Review does not replace an axis. If it is absent, record `skipped-uninstalled` and do not install it. If installed and authorized to send the diff, run it against the same base/head. Distinguish missing permission from execution failure. Treat output as candidate findings; only defects confirmed in the actual code warrant a fix.

A missing axis or missing evidence is not a pass. If the head or approved contract changes, repeat all three reviews for the new binding.
