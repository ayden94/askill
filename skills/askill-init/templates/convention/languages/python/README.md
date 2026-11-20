# Python conventions

## When to read

Before editing Python code, identify supported interpreter versions, the configured runner, and the process or framework that owns startup. Read the leaf for the behavior you are changing.

| Task | Read |
| --- | --- |
| Add a CLI, file importer, or code run at startup | [Entry points and resource ownership](entry-points.md) |
| Accept a generator, accumulate results, or add an optional collection | [Iterators and call-local state](iterators-and-state.md) |
| Translate a recoverable failure or decide which exceptions to catch | [Exception boundaries](exception-boundaries.md) |
| Test missing configuration, filesystem effects, or rollback | [Testing side effects](testing.md) |

Examples use the standard library on Python 3.9+. Follow the project's current test framework and configuration rather than adopting another one for these examples.
