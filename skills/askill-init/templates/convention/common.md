# Common

- Follow naming, module boundaries, and tooling already used in the affected area. Prefer extending an existing seam to creating a parallel abstraction.
- Keep the diff within the agreed scope. Do not fold unrelated cleanup, dependency changes, or contract changes into a refactor.
- Check input at the boundary, and make failure explicit without exposing secrets or sensitive data.
- Use existing formatter, lint, and build commands. Record checks that could not run.

## Name the decision, not the machinery

Prefer `reserveSeats(count)` to `process(data, true)`. Name units and lifetimes (`timeoutMs`, `reservedUntil`); replace a boolean switch with separate operations when its branches have different preconditions. Keep a straightforward local expression inline rather than inventing a helper with no meaningful name.

## Keep policy apart from effects

Work out whether an order is eligible separately from writing it. Put the transaction at the level that owns the entire change; checking eligibility in one helper and committing each row elsewhere makes partial success hard to reason about. Never hide a network request inside a getter or a mapping callback.

## Review the smallest useful change

Before extracting a shared abstraction, identify the invariant shared by the callers. Similar-looking formatting and billing rules can change for different reasons. Ask which caller becomes simpler, who handles failure, and what observable behavior a refactor must preserve. Do not block on line counts or personal naming preferences.
