# Axum rulebook

Read only the topics that match the task.

| Task | Read |
| --- | --- |
| Change route parameters, JSON handling, or the rejection contract | [Extractors and rejections](extractors-and-rejections.md) |
| Combine routers, scope middleware, or wire shared state | [Router composition and state](router-composition-and-state.md) |
| Convert service failures to responses or manage async resources | [Responses and async work](responses-and-async-work.md) |
| Exercise the configured router as a Tower service | [Testing](testing.md) |
| Drain a running server or change process termination | [Graceful shutdown](graceful-shutdown.md) |
| Set a byte budget for a raw body outside buffered extractors | [Raw body budgets](raw-body-budgets.md) |
| Implement continuation through a changing collection | [Cursor pagination](cursor-pagination.md) |
| Decide which authenticated callers can discover a resource | [Resource visibility](resource-visibility.md) |
| Arrange layers whose input or output depends on another layer | [Tower layer ordering](tower-layer-ordering.md) |
| Stream events to clients with bounded buffering and cleanup | [Server-sent events](server-sent-events.md) |
| Bound time to a response and convert a Tower timeout to HTTP | [Response deadlines](response-deadlines.md) |

Examples target Axum 0.8, Tower 0.5 (with `util` for `ServiceExt`), Tokio 1, and Serde for JSON; use the project's `Cargo.toml`, `Cargo.lock`, enabled features, and API contract. Axum 0.8 uses `{id}` for route captures. Snippets omit ordinary imports and use local names for application-specific types and helpers.
