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

For a version-sensitive rule, check the affected package at the pinned base: its manifest and resolved dependency, compiler settings, relevant feature flags, and deployment runtime or library support floor. Keep the behavioral invariant separate from the API used in an example. Record the applicable version or constraint and the evidence path with the selected rule. In a monorepo do not assume sibling packages use the same version. If compatibility is unclear and affects a verdict, request evidence; do not upgrade dependencies or reject a compatible implementation merely to match the example.

On upgrades, a project may have kept its original stack index while adding new topic files. If an expected topic is not in that index, list the selected book's filenames at the pinned base. Use the installed template's README only as a navigation hint, never as project policy. Select an existing project leaf only when its trigger matches the issue and it does not conflict with an explicit local exclusion. Do not open every file just to discover candidates.

When a supported version boundary changes the implementation, document non-overlapping ranges (for example `< X` and `>= X`), both compatible approaches, and one behavioral check that both must pass. Verify the cutoff against the upstream release documentation. If all supported versions share one implementation, do not invent a historical fallback.
