# Gin rulebook

Read the matching topic before editing. For an endpoint change, pair the applicable production topic with the testing leaf.

| Task | Read |
| --- | --- |
| Decode JSON, path parameters, or query strings | [Request boundaries](request-boundaries.md) |
| Mount a protected group, abort a request, or instrument responses | [Middleware and routing](middleware-and-routing.md) |
| Call a service, cancel work, or map a service failure | [Service and response boundaries](service-and-responses.md) |
| Verify router behavior and side effects | [Testing](testing.md) |
| Drain in-flight requests during a deploy or shutdown | [Server shutdown](server-shutdown.md) |
| Accept or change a raw upload with a byte budget | [Upload byte budgets](upload-byte-budgets.md) |
| Add continuation cursors to a changing list | [Cursor pagination](cursor-pagination.md) |
| Decide whether an authenticated caller can discover a resource | [Resource visibility](resource-visibility.md) |
| Set, propagate, or log a request correlation ID | [Request correlation](request-correlation.md) |
| Flush an incremental export and handle failures after commit | [Streaming exports](streaming-exports.md) |
| Require conditional updates to prevent stale writes | [Conditional writes](conditional-writes.md) |

Examples assume Gin 1.x APIs checked against 1.11 and Go's standard HTTP stack. The project's `go.mod`, router factory, and wire contract take precedence. Snippets omit ordinary imports and use local names for application-specific helpers and services.
