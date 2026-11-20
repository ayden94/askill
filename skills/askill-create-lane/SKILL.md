---
name: askill-create-lane
description: Plan one lane from registered issues, with source provenance, evidence-backed dependencies, and scoped execution grants.
---

# Create a lane

Accept a confirmed issue artifact, an explicit set of issue IDs, or a description of issues to collect. Resolve all three forms with read-only issue lookups and normalize them to the same confirmed artifact. Reject empty sets, duplicates, and unresolved issues. Recommend related issues only when asked.

Leave independent issues parallel. Add a dependency only if one issue cannot meet its acceptance criteria without the other's result. Record the reason; note potential file conflicts separately.

Freeze the base branch, source issues, dependencies, retry policy, and grants for each side effect in `.askill/lanes/<lane-id>/plan.json`. Do not create branches or worktrees, implement changes, push, or merge during planning.
