# Responses and async work

**Invariant:** Map each domain result to one response and release short-lived lock guards before unrelated I/O.

**Compatibility:** Stable [`IntoResponse` and handler `Send` requirements](https://docs.rs/axum/0.8.0/axum/handler/index.html) for the ordinary async-function recipe on Axum 0.6–0.8. Lock lifetime is a Rust concurrency concern, not an Axum version difference; Tokio spawning is a separate lifetime decision.

**Acceptance check:** A second request acquires the configuration snapshot while the first awaits its gateway; not-found and unexpected errors preserve exact public responses without leaking diagnostics.

## When to read

Read when translating application errors, storing shared mutable data, awaiting a dependency, or handing work off from a request handler.

## Map domain failures to one explicit response contract

**Wrong —** a generic success tuple neither carries the failure status nor keeps internal error text private.

```rust
async fn show_widget(Path(id): Path<u64>) -> (StatusCode, String) {
    match load_widget(id).await {
        Ok(widget) => (StatusCode::OK, widget.name),
        Err(err) => (StatusCode::OK, err.to_string()),
    }
}
```

**Right —** use a concrete error type with `IntoResponse`; application methods return domain outcomes and the HTTP layer sets status and body together. `WidgetView` and `ErrorBody` are serializable transport DTOs.

```rust
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = match self {
            Self::NotFound => (StatusCode::NOT_FOUND, "widget_not_found"),
            Self::Dependency(error) => {
                tracing::error!(?error, "widget lookup failed");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
        };
        (status, Json(ErrorBody { code })).into_response()
    }
}

async fn show_widget(Path(id): Path<u64>) -> Result<Json<WidgetView>, ApiError> {
    Ok(Json(load_widget(id).await?))
}
```

Keep DTO serialization predictable. For custom serializers that can fail, handle serialization before attaching a success status rather than relying on a tuple that might override an error response's status.

## End mutable borrows and lock guards before unrelated I/O

**Wrong —** a synchronous mutex guard held across `.await` can make the handler future non-`Send`. Switching to an async mutex without changing scope can still serialize unrelated requests.

```rust
async fn current(State(state): State<AppState>) -> Result<Json<Reading>, ApiError> {
    let config = state.config.lock().expect("config lock poisoned");
    Ok(Json(state.gateway.fetch(&config.region).await?))
}
```

**Right —** snapshot only the data needed by the downstream call, then release the guard lexically.

```rust
async fn current(State(state): State<AppState>) -> Result<Json<Reading>, ApiError> {
    let region = {
        let config = state.config.lock().map_err(|_| config_unavailable())?;
        config.region.clone()
    };
    Ok(Json(state.gateway.fetch(&region).await?))
}
```

Use a synchronous lock only for short nonawaiting critical sections. If a result must update the shared state, reacquire the lock and check its version or use a transaction to avoid overwriting a newer update.

## Exceptions and tradeoffs

An async mutex or a dedicated owner task may be appropriate when a single I/O resource truly needs serialized access. Request-required work should be awaited; spawned tasks have their own lifetime. Durable work needs an ownership and shutdown policy, and the response must only claim acceptance once the work is enqueued. An already-started response stream cannot switch to a JSON error; test stream failure and cleanup separately.

## Verification and pass criteria

Run `cargo check` on the server crate to catch non-`Send` handlers. Inject a gateway that signals entry and blocks on a signal; while it is blocked, exercise a second operation that reads the same shared configuration, with a bounded timeout. Pass if the second operation can obtain the snapshot before releasing the first gateway. Inject not-found and unexpected failures and verify each returns its exact status and error code without leaking the internal diagnostic.
