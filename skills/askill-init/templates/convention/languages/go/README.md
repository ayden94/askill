# Go conventions

## When to read

Before editing Go code, check the module's Go version, existing package boundaries, and CI commands. Read the relevant leaf rather than importing the whole rulebook into every task.

| Task | Read |
| --- | --- |
| Add a dependency seam or change a public constructor | [Interfaces at the consumer](consumer-interfaces.md) |
| Start a goroutine or change channel and context handling | [Goroutine ownership and cancellation](concurrency.md) |
| Propagate, classify, or translate a failure | [Errors and their identity](errors.md) |
| Verify subcases, filesystem behavior, or worker shutdown | [Testing Go contracts](testing.md) |

Examples use the standard library on Go 1.20+. Match the current module's tooling and race-detector support.
