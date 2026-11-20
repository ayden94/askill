# JavaScript conventions

## When to read

Before changing JavaScript behavior or reviewing a JavaScript patch, check the project's runtime target, module format, runner, and adjacent code. Start with the row that matches your task; read a second leaf only if the change crosses that concern.

| Task | Read |
| --- | --- |
| Interpret configuration, request parameters, or optional values | [Boundary values and coercion](boundary-values.md) |
| Start, join, or cancel asynchronous I/O | [Asynchronous work and cancellation](async-work.md) |
| Return collections, sort records, or hold derived state | [Ownership and mutation](ownership.md) |
| Test a rejection, superseded request, or dependency with shared state | [Testing asynchronous contracts](testing.md) |
| Resolve data shipped alongside a Node ES module | [Module-relative resources](module-resources.md) |
| Attach or replace browser event listeners | [Disposable event subscriptions](event-disposal.md) |
| Advance a calendar date without involving local time | [Calendar dates](calendar-dates.md) |
| Calculate totals in a fixed monetary unit | [Exact monetary totals](money.md) |
| Connect Node streams and handle write failures | [Stream pipelines](stream-pipelines.md) |
| Key a lookup table by untrusted or reserved-looking strings | [Dynamic lookup tables](lookup-tables.md) |
| Truncate text by visible characters | [Grapheme boundaries](graphemes.md) |

Examples use modern JavaScript; Node-specific examples state their assumptions. Use the project's existing tools and compatibility target rather than changing either to match an example.
