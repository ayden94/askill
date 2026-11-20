# CLI

Use `node /path/to/askill/src/cli.mjs` or the `askill` package binary in an environment that installs local package bins. Run `--help` to list commands. Pass `--root /path/to/target` unless running from the target Git project, and pass `--input request.json` or `--input -` for a JSON object from stdin. Commands write one JSON result to stdout; errors are nonzero and reported on stderr.

## Intake and planning

| Command | JSON input |
|---|---|
| `init` | The project config (see the [local example](../examples/local/config.json)) |
| `scope` | `intake_id`, `problem`, `exclusions`, `drafts` (`draft_id`, `title`, `body`), optional `approval_scope` |
| `issues` | `artifact_id` and exactly one of `intake_id` or `issue_ids`; remote registration additionally takes command authority |
| `create-lane` | `lane_id` and `artifact_id` (recommended) or `issue_ids`; optional dependency graph, reasons, retry policy, and authority scope |

`init` does not edit `.gitignore` or Git's `info/exclude`. Choose what to track or exclude yourself. If an older version added an `# askill runtime state` block to `info/exclude`, it is left untouched; edit or remove it if you no longer want that policy. Keep credentials out of shared config.

`init` also fills in missing Markdown starter files under `.askill/convention/` without overwriting edits. Update `README.md` and the linked common, frontend, backend, or testing guidance to match the project. Do not ignore this directory: commit the rules to the configured base branch to make them available to the lane. `plan`, implementer dispatch, and the three review assignments carry the same convention index path and pinned base when present. Use that base rather than uncommitted files or the implementation head to read rules.

Issue creation on a remote provider requires both `approval_scope.issue_create: true` on the agreed intake and `authority.issue_create: true` on the `issues` command. Confirm the resolved remote project before granting that permission. If a remote creation response is ambiguous, observe the tracker and link the actual issue instead of repeating the write blindly.

## Execution and review

Import with `import-lane` and `{"lane_id":"…"}`. The immutable `plan.json` and mutable `state.json` live together in `.askill/lanes/<lane-id>/`. For an older lane, run the same import once: it validates and copies the legacy plan and execution state into the unified folder without resetting progress or removing the originals. Use `plan-all` with the same input or `plan` with `{"lane_id":"…","issue":"…"}`. A plan exposes the assigned branch and worktree, current base and head, issue digest, and accepted contract digest when present. Re-read the plan rather than reusing stale hashes.

| Plan action | Coordinator action |
|---|---|
| `preflight` | Confirm the issue contract, then `record` with `kind: "preflight"`, lane/issue, and `contract`. The contract refers to exactly the observed `base_sha` and `issue_sha256`. See the [example](../examples/local/preflight.json). |
| `implement` / `fix-back` | Assign `dispatch` to an implementer. If it includes `setup`, run its Git argument vector in its exact `cwd` and recheck the checkout. Apply the authorized fix, run the agreed checks, and produce a local commit if granted. |
| `record-implementation` | `record` with `kind: "implementation"`, the current binding, `implementer`, and `checks`. Every criterion needs a receipt `{criterion, command, exit_code, observation}`; describe a manual procedure in `command` when there is no automated check. |
| `review` | Dispatch the returned assignments in one parallel wave. `record` each result with `kind: "review"`, the binding, `axis`, `reviewer`, `verdict`, and `evidence`. Stop when a confirmed blocker requires fix-back, then replan. |
| `create-pr` / `push` | Only if the configured destination and lane grant allow it, call `publish-pr` with the current binding. This does not merge. |
| `wait-ci`, `request-merge-approval`, or other blocked/wait actions | Read the reason and observe again or resolve the missing input. Do not substitute an action of your choosing. |
| `done` | Report the observed outcome, distinguishing verified local head, merged PR, and an issue closed externally. |

The binding is `{lane_id, issue, base_sha, head_sha, contract_sha256}`. `record` rejects stale results rather than relabeling them. Use `run-ocr` with the same binding; transmitting the diff requires both project policy `policy.ocr_external: true` and explicit `authorized: true`. Missing OCR is a recorded skip, not a reason to install software. The coordinator calls this during the review stage, before concluding the lane. It confirms any actionable candidate in the checkout rather than treating OCR text as a verdict.

Merge and cleanup are explicit host handoffs, not CLI mutations. A host with a current grant carries out the indicated action only after rechecking the observed head, CI and mergeability or the registered clean worktree identity, as applicable. Replan after the host observes the real result. For a local dependency, integrate the verified prerequisite commit into the configured base before dispatching the dependent issue.

## Independent agents

The host coordinator owns agent spawning. It uses `plan` to obtain the next assignment, supplies only the relevant stage input, and submits actual results with `record`. Use separate read-only agents or human reviewers for contract, code, and verification; an implementation agent returning three labels is not an independent review. Hosts without independent reviewers can prepare inputs and run checks but cannot mark the lane verified without those verdicts.

The receipt boundary checks bindings and distinct identities. It assumes a trusted coordinator records authentic results; it does not attest agent identity cryptographically. Do not expose the CLI's write commands to implementation or review children. If an in-progress writer leaves an abandoned `.askill/.write-lock`, first establish that no process still owns it before recovering the lock.
