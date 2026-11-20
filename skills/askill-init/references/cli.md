# CLI

Run `node "<installed askill-init skill directory>/scripts/cli.mjs" <command>`. Resolve the directory from the installed `askill-init` skill's `SKILL.md`, not from the target repository. Run `--help` to list commands. Pass `--root /path/to/target` unless running from the target Git project, and pass `--input request.json` or `--input -` for a JSON object from stdin. Commands write one JSON result to stdout; errors are nonzero and reported on stderr.

## Intake and planning

Run `init` once for each project. Start subsequent lanes with `scope` or with existing issues; do not reinitialize project settings as part of every lane.

| Command | JSON input |
|---|---|
| `init` | Project config (example below) |
| `scope` | `intake_id`, `problem`, `exclusions`, `drafts` (`draft_id`, `title`, `body`), optional `approval_scope` |
| `issues` | `artifact_id` and exactly one of `intake_id` or `issue_ids`; remote registration additionally takes command authority |
| `create-lane` | `lane_id` and `artifact_id` (recommended) or `issue_ids`; optional dependency graph, reasons, retry policy, and authority scope |

`init` does not edit `.gitignore` or Git's `info/exclude`. Choose what to track or exclude yourself. If an older version added an `# askill runtime state` block to `info/exclude`, it is left untouched; edit or remove it if you no longer want that policy. Keep credentials out of shared config.

`init` also fills in missing Markdown starter files under `.askill/convention/` without overwriting edits. Update `README.md` and the linked common, frontend, backend, or testing guidance to match the project. Do not ignore this directory: commit the rules to the configured base branch to make them available to the lane. `plan`, implementer dispatch, and the three review assignments carry the same convention index path and pinned base when present. Use that base rather than uncommitted files or the implementation head to read rules.

Local-only config example (replace `main` if the target uses a different base branch):

On first setup, choose exactly one ticket system independently of the issue tracker and PR/MR destination. Set `destinations.tickets` to `{"provider":"jira"}`, `{"provider":"linear"}`, `{"provider":"notion"}`, or `null` for none. This records the choice only; it does not configure MCP, store credentials, or authorize ticket writes.

```json
{
  "version": 1,
  "base_branch": "main",
  "convention_profile": {
    "languages": ["python"],
    "frameworks": ["fastapi"]
  },
  "destinations": {
    "issues": { "provider": "local" },
    "pull_requests": null,
    "tickets": null
  }
}
```

The installed init skill [infers the profile from the repository](stack-discovery.md) before calling the CLI. Direct CLI callers supply their own profile. Do not require a frontend/backend classification. For a framework-free project, use an empty `frameworks` array. Each array accepts zero or more unique IDs. Without a profile, only shared implementation and testing guidance is seeded. Existing files are never overwritten or pruned.

| Field | Presets |
|---|---|
| `project_types` (optional; existing profiles remain valid) | `frontend`, `backend`, `cli`, `library`, `mobile`, `devops` |
| `languages` | `javascript`, `typescript`, `python`, `go`, `java`, `kotlin`, `rust` (each includes a matching testing guide) |
| `frameworks` | `react`, `nextjs`, `express`, `django`, `fastapi`, `gin`, `spring-boot`, `ktor`, `axum` |

Issue creation on a remote provider requires both `approval_scope.issue_create: true` on the agreed intake and `authority.issue_create: true` on the `issues` command. Confirm the resolved remote project before granting that permission. If a remote creation response is ambiguous, observe the tracker and link the actual issue instead of repeating the write blindly.

## Execution and review

Import with `import-lane` and `{"lane_id":"…"}`. The immutable `plan.json` and mutable `state.json` live together in `.askill/lanes/<lane-id>/`. For an older lane, run the same import once: it validates and copies the legacy plan and execution state into the unified folder without resetting progress or removing the originals. Use `plan-all` with the same input or `plan` with `{"lane_id":"…","issue":"…"}`. A plan exposes the assigned branch and worktree, current base and head, issue digest, and accepted contract digest when present. Re-read the plan rather than reusing stale hashes.

| Plan action | Coordinator action |
|---|---|
| `preflight` | Confirm the issue contract, then `record` with `kind: "preflight"`, lane/issue, and `contract`. The contract refers to exactly the observed `base_sha` and `issue_sha256`. |
| `implement` / `fix-back` | Assign `dispatch` to an implementer. If it includes `setup`, run its Git argument vector in its exact `cwd` and recheck the checkout. Apply the authorized fix, run the agreed checks, and produce a local commit if granted. |
| `record-implementation` | `record` with `kind: "implementation"`, the current binding, `implementer`, and `checks`. Every criterion needs a receipt `{criterion, command, exit_code, observation}`; describe a manual procedure in `command` when there is no automated check. |
| `review` | Dispatch the returned assignments in one parallel wave. `record` each result with `kind: "review"`, the binding, `axis`, `reviewer`, `verdict`, and `evidence`. Stop when a confirmed blocker requires fix-back, then replan. |
| `create-pr` / `push` | Only if the configured destination and lane grant allow it, call `publish-pr` with the current binding. This does not merge. |
| `wait-ci`, `request-merge-approval`, or other blocked/wait actions | Read the reason and observe again or resolve the missing input. Do not substitute an action of your choosing. |
| `done` | Report the observed outcome, distinguishing verified local head, merged PR, and an issue closed externally. |

The binding is `{lane_id, issue, base_sha, head_sha, contract_sha256}`. `record` rejects stale results rather than relabeling them. Use `run-ocr` with the same binding; transmitting the diff requires both project policy `policy.ocr_external: true` and explicit `authorized: true`. Missing OCR is a recorded skip, not a reason to install software. The coordinator calls this during the review stage, before concluding the lane. It confirms any actionable candidate in the checkout rather than treating OCR text as a verdict.

Merge and cleanup are explicit host handoffs, not CLI mutations. A host with a current grant carries out the indicated action only after rechecking the observed head, CI and mergeability or the registered clean worktree identity, as applicable. Replan after the host observes the real result. For a local dependency, integrate the verified prerequisite commit into the configured base before dispatching the dependent issue.

## Lane retrospective

| Command | JSON input and outcome |
|---|---|
| `retro-note` | `lane_id`, optional `issue`, and one candidate `{kind, title, evidence, next_step}`. Notes survive coordinator restarts and identical notes are deduplicated. |
| `retro-plan` | `lane_id`. Returns `wait-lane` with unfinished issues, `retro` with evidence and the current `basis_sha256`, or `done` with the previously saved report. |
| `record-retro` | `lane_id`, `basis_sha256` from `retro-plan`, `summary`, and `recommendations` (possibly empty). Only accepts a fresh completed-lane basis; replays of the same report are safe. |

Candidate kinds are `follow-up-issue` and `convention-change`. Local lanes may finish with verified local heads; for PR/MR work, publishing alone does not make an issue done. The host runs one retrospective after all lane issues reach terminal `done`. Recommendations do not create issues, edit conventions, or change a lane's execution state.

## Independent agents

The host coordinator owns agent spawning. It uses `plan` to obtain the next assignment, supplies only the relevant stage input, and submits actual results with `record`. Use separate read-only agents or human reviewers for contract, code, and verification; an implementation agent returning three labels is not an independent review. Hosts without independent reviewers can prepare inputs and run checks but cannot mark the lane verified without those verdicts.

The receipt boundary checks bindings and distinct identities. It assumes a trusted coordinator records authentic results; it does not attest agent identity cryptographically. Do not expose the CLI's write commands to implementation or review children. If an in-progress writer leaves an abandoned `.askill/.write-lock`, first establish that no process still owns it before recovering the lock.
