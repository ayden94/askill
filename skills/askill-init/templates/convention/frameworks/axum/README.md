# Axum rulebook

| Task | Read |
| --- | --- |
| Change route parameters, JSON handling, or the rejection contract | [Extractors and rejections](extractors-and-rejections.md) |
| Combine routers, scope middleware, or wire shared state | [Router composition and state](router-composition-and-state.md) |
| Convert service failures to responses or manage async resources | [Responses and async work](responses-and-async-work.md) |
| Exercise the configured router as a Tower service | [Testing](testing.md) |

Examples target Axum 0.8, Tower 0.5 (with `util` for `ServiceExt`), Tokio 1, and Serde for JSON; use the project's `Cargo.toml`, `Cargo.lock`, enabled features, and API contract. Axum 0.8 uses `{id}` for route captures. Snippets omit ordinary imports and use local names for application-specific types and helpers.
