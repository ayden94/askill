---
name: askill-execute-lane
description: Resume a lane by observing current state, taking one authorized action, and recording contract- and head-bound evidence.
---

# Execute a lane

Validate `.askill/lanes/<lane-id>/plan.json` and start or resume from `state.json` in the same directory. Importing a plan must not expand grants or reset an active lane.

1. Read the current state from Git and the configured provider.
2. Dispatch the single action chosen by the engine. Independent issues may run in parallel in separate worktrees.
3. Only the lead validates and records results in the shared ledger. Observe again before selecting the next action.

Select rulebook topics **per issue**, not once for the entire lane. During preflight, follow the pinned project index to the stack README and match its task rows against the expected change. Record the selected leaf paths and why they apply in the contract's `conventions`. Pass that same selection to the implementer and reviewers. Do not recursively read every installed topic. If the actual diff introduces a new concern (for example, an HTTP change also adds a queue consumer), reopen preflight to add the applicable topic before reviewing the revised contract.

Run `askill-issue-preflight`, `askill-issue-implement`, and `askill-review-head` in order. Use `askill-sync-pr` only when a destination and the required grants exist. Fix implementation defects in the same issue worktree and review the new head. Do not classify input or host failures as code defects.

Use `retro-note` for out-of-scope findings or recurring verification problems. Opening a PR/MR does not finish a remote lane. When every issue is observed as `done`, invoke `askill-retro` once for follow-up recommendations.

Use `askill import-lane`, then `askill plan` or `askill plan-all`. Submit actual outcomes with `askill record`. Run `scripts/cli.mjs` from the installed `askill-init` skill with Node.js; see its `references/cli.md` for JSON inputs. If agent dispatch is unavailable, approved independent human reviewers may supply verdicts. Never represent one person's three roles as independent reviews.
