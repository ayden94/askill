# JavaScript conventions

## When to read

Before changing JavaScript behavior or reviewing a JavaScript patch, check the project's runtime target, module format, runner, and adjacent code. Start with the row that matches your task; read a second leaf only if the change crosses that concern.

| Task | Read |
| --- | --- |
| Interpret configuration, request parameters, or optional values | [Boundary values and coercion](boundary-values.md) |
| Start, join, or cancel asynchronous I/O | [Asynchronous work and cancellation](async-work.md) |
| Return collections, sort records, or hold derived state | [Ownership and mutation](ownership.md) |
| Test a rejection, superseded request, or dependency with shared state | [Testing asynchronous contracts](testing.md) |

Examples use modern JavaScript; Node-specific examples state their assumptions. Use the project's existing tools and compatibility target rather than changing either to match an example.
