---
name: askill-retro
description: Produce one evidence-based retrospective after a lane finishes, recommending separate follow-up issues or project conventions.
---

# Review the completed lane

When an out-of-scope finding or recurring verification problem appears, use `retro-note` to record the evidence and a possible next step rather than expanding the lane. Do not defer a contract violation or missing required evidence to the retrospective.

1. Run `retro-plan`. If it returns `wait-lane`, finish the pending issues first. If it returns `done`, return the existing report without rewriting it.
2. On `retro`, read the outcomes, current verification evidence, and recorded candidates. If a PR/MR exists, inspect available reviews and CI read-only; distinguish unavailable evidence from an observed result.
3. Recommend only evidence-backed actions, in priority order. Use `follow-up-issue` for deferred features or bugs and `convention-change` for testing or implementation rules that could prevent recurrence. Record an empty list if there are no recommendations.
4. Save the summary and recommendations with `record-retro`. Recommendations are not grants: opening issues, editing conventions, posting comments, and creating another lane each require a separate request.
