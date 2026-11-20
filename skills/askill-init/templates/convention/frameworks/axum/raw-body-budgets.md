# Raw body budgets

**Invariant:** Bound raw bytes during collection and distinguish overflow from transport failure before persisting.

**Compatibility:** Axum 0.6 uses Hyper 0.14 / `http-body` 0.4; Axum 0.7 uses the new body stack, but `axum::body::to_bytes` first appears in [Axum 0.7.2](https://github.com/tokio-rs/axum/blob/axum-v0.8.0/axum/CHANGELOG.md#072-03-december-2023). An extractor's `DefaultBodyLimit` does not cap independent raw collection.

**Acceptance check:** At-cap data writes once, an unknown-length overflow returns 413, and an injected transport error takes the different read-error path without persisting.

## When to read

Read when a handler receives `Body` directly to ingest a small binary object rather than using the framework's buffered extractors.

## Put the limit on raw collection

**Wrong —** marking a route with `DefaultBodyLimit` does not enforce the limit on an independent `to_bytes` call.

```rust
let app = Router::new()
    .route("/artifact", put(put_artifact))
    .layer(DefaultBodyLimit::max(MAX_ARTIFACT));

async fn put_artifact(body: Body) -> Result<StatusCode, ApiError> {
    let bytes = to_bytes(body, usize::MAX).await.map_err(ApiError::body_read)?;
    persist_artifact(bytes).await?;
    Ok(StatusCode::NO_CONTENT)
}
```

- **Axum 0.6.x:** Collect with `hyper::body::to_bytes(http_body::Limited::new(body, MAX_ARTIFACT)).await` on Hyper 0.14 and [`http-body` 0.4](https://docs.rs/http-body/0.4.6/http_body/struct.Limited.html). Classify `error.is::<http_body::LengthLimitError>()` on its boxed error; map other failures to the read-error branch.
- **Axum 0.7.0–0.7.1:** With `use http_body_util::BodyExt as _`, use [`http_body_util::Limited::new(body, MAX_ARTIFACT).collect().await`](https://docs.rs/http-body-util/0.1.0/http_body_util/struct.Limited.html), then `.to_bytes()` on the successful collection. Check `error.is::<http_body_util::LengthLimitError>()` on the boxed error.
- **Axum 0.7.2–0.8.x:** Use [`axum::body::to_bytes`](https://docs.rs/axum/0.7.2/axum/body/fn.to_bytes.html) and inspect its wrapped source as above.

**Right —** pass the explicit ceiling to `axum::body::to_bytes` and distinguish the limit from other read failures.

```rust
use http_body_util::LengthLimitError;
use std::error::Error as _;

async fn put_artifact(body: Body) -> Result<StatusCode, ApiError> {
    let bytes = to_bytes(body, MAX_ARTIFACT).await.map_err(|error| {
        if error.source().is_some_and(|e| e.is::<LengthLimitError>()) {
            ApiError::new(StatusCode::PAYLOAD_TOO_LARGE, "artifact_too_large")
        } else {
            ApiError::body_read(error)
        }
    })?;
    persist_artifact(bytes).await?;
    Ok(StatusCode::NO_CONTENT)
}
```

## Tradeoffs and assumptions

`MAX_ARTIFACT` is a small `usize`; `http-body-util` supplies the limit error type. `ApiError::body_read` logs the cause internally and maps only actual read failures, not storage failures. For a larger upload, count bytes as frames arrive and stage until EOF instead of collecting. A per-request byte cap does not bound aggregate memory or duration; add separate concurrency and time budgets when needed.

## Verification

Exercise the mounted route with content at the cap and with a multi-frame body without `Content-Length` that exceeds it. Assert 204 with one write for the first and 413 with no write for the second. Inject an I/O error in a separate body stream and assert the read-error path, not the size-limit path, with no write.
