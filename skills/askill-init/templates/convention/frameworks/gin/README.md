# Gin rulebook

Read the matching topic before editing. For an endpoint change, pair the applicable production topic with the testing leaf.

| Task | Read |
| --- | --- |
| Decode JSON, path parameters, or query strings | [Request boundaries](request-boundaries.md) |
| Mount a protected group, abort a request, or instrument responses | [Middleware and routing](middleware-and-routing.md) |
| Call a service, cancel work, or map a service failure | [Service and response boundaries](service-and-responses.md) |
| Verify router behavior and side effects | [Testing](testing.md) |

Examples assume Gin 1.x APIs checked against 1.11 and Go's standard HTTP stack. The project's `go.mod`, router factory, and wire contract take precedence. Snippets omit ordinary imports and use local names for application-specific helpers and services.
