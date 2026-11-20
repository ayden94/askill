# TypeScript conventions

## When to read

Use this router when changing a TypeScript API, boundary, state model, or test. Read the applicable project `tsconfig`, validation stack, and CI commands first; then follow only the matching rows.

| Task | Read |
| --- | --- |
| Adapt external JSON, configuration, or data from an untyped SDK | [Runtime boundaries](runtime-boundaries.md) |
| Represent outcomes or add a state to an existing operation | [Discriminated results](discriminated-results.md) |
| Design an exported signature, generic, or read-only view | [Caller-facing types](caller-facing-types.md) |
| Verify inference, invalid calls, or runtime validation | [Testing type and runtime contracts](testing.md) |
| Evolve an exported function without breaking installed consumers | [Public API compatibility](api-compatibility.md) |
| Prevent a default argument from widening a generic inferred elsewhere | [Generic inference authority](inference-authority.md) |
| Distinguish same-shaped identifiers at compile time | [Domain identity types](identity-types.md) |
| Specify omission, clearing, and assignment in a patch type | [Optional patch properties](optional-patches.md) |
| Register callbacks that may receive every variant of an event | [Callback variance](callback-variance.md) |
| Make a keyed registry complete and retain each entry's literal type | [Typed registries](typed-registries.md) |
| Add a type-only dependency without executing another module | [Type-only imports](type-only-imports.md) |

Examples assume TypeScript 4.9+ with `strict` and an ES2022 library. Use the project's installed compiler and flags; an example is not a reason to upgrade or add a dependency.
