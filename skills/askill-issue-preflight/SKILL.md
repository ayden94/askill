---
name: askill-issue-preflight
description: Bind one lane issue to an approved implementation contract and observable acceptance criteria before editing.
---

# Preflight one issue

Confirm the issue snapshot and base commit. Apply existing project documentation first. If none exists, inspect the agreed issue, observable behavior, callers, and tests. Do not turn an existing behavior into a guarantee without deciding it should be preserved.

If `plan.convention` exists, read the index at the base commit and select only the rules relevant to the change. Record their sources and scope under `conventions` in the contract. Read the index and linked files with `git show <base_sha>:<path>`. If there is no index, use existing project guidance. Resolve conflicting rules before implementation.

Specify the goal, scope, invariants, non-goals, expected paths, and the method and expected result for each acceptance criterion. Resolve outstanding product decisions and guarantees. Missing project documentation alone is not a blocker.

Bind the approved contract to the issue and base commit. Reopen preflight if the requirement changes or a fix falls outside scope. Do not modify code or grant permissions.

When the base includes `.askill/convention/rulebooks.md`, read it alongside the project index. Follow the selected stack router to the relevant topic files; record those leaf paths, not just the directory or its README. A custom project rule remains authoritative over an illustrative starter example. Do not load every rulebook for every change.
