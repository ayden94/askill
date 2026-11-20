# Express rulebook

Check the installed Express major, router mounts, middleware stack and application error contract before editing. The examples use existing application parsers and test tools; do not install dependencies to match them.

| Task | Read |
| --- | --- |
| Mount a router, add a parser, or change route admission | [Routing and middleware order](routing-and-middleware.md) |
| Accept or return runtime data from a route | [Request and response boundaries](request-boundaries.md) |
| Handle a rejected promise, error response, or stream failure | [Errors and response ownership](errors-and-responses.md) |
| Verify route matching, middleware, writes, or error shape | [Mounted-stack testing](testing.md) |
| Handle a termination signal without cutting off admitted requests | [Graceful shutdown](graceful-shutdown.md) |
| Distinguish invalid credentials, denied access, and verifier downtime | [Authentication and authorization](authentication-and-authorization.md) |
| Return the next page consistently when records share a sort value | [Cursor pagination](pagination.md) |
| Measure completed and disconnected requests without leaking input | [Request observability](observability.md) |
| Accept multipart files with bounded staging and cleanup | [File uploads](uploads.md) |
| Derive client IP or protocol behind an ingress | [Reverse proxy settings](proxy-settings.md) |
| Cancel disconnected work and release a request-owned lease | [Request-scoped resources](resource-lifecycle.md) |
