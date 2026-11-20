# Go conventions

## When to read

Before editing Go code, check the module's Go version, existing package boundaries, and CI commands. Read the relevant leaf rather than importing the whole rulebook into every task.

| Task | Read |
| --- | --- |
| Add a dependency seam or change a public constructor | [Interfaces at the consumer](consumer-interfaces.md) |
| Start a goroutine or change channel and context handling | [Goroutine ownership and cancellation](concurrency.md) |
| Propagate, classify, or translate a failure | [Errors and their identity](errors.md) |
| Verify subcases, filesystem behavior, or worker shutdown | [Testing Go contracts](testing.md) |
| Bound an outbound HTTP request and take ownership of its response body | [HTTP clients](http-clients.md) |
| Consume bytes even when a reader returns an error with its last chunk | [Reader progress and errors](reader-loops.md) |
| Make a collection-backed type useful without a constructor | [Usable zero values](zero-values.md) |
| Decode one bounded JSON request under a strict schema policy | [JSON request bodies](json-bodies.md) |
| Drain HTTP requests before process shutdown | [HTTP server shutdown](http-shutdown.md) |
| Iterate database query results without hiding a late failure | [SQL row iteration](sql-rows.md) |
| Produce reproducible text from an unordered map | [Deterministic map output](map-output.md) |

Examples use the standard library on Go 1.20+. Match the current module's tooling and race-detector support.
