# Response deadlines

## When to read

Read when adding a Tower deadline to the time an ordinary route takes to produce its response.

## Convert the timeout error outside the timeout layer

**Wrong —** `tower::timeout::TimeoutLayer` introduces a fallible service that Axum cannot mount as written.

```rust
let app = Router::new().route("/quote", get(quote))
    .layer(tower::timeout::TimeoutLayer::new(Duration::from_millis(500)));
```

**Right —** add an outer `HandleErrorLayer` that converts the failure to a response. This API uses 503 for a local processing deadline.

```rust
async fn handle_deadline(error: BoxError) -> Response {
    if error.is::<tower::timeout::error::Elapsed>() {
        return (StatusCode::SERVICE_UNAVAILABLE, "quote_deadline").into_response();
    }
    record_service_failure(&error);
    StatusCode::INTERNAL_SERVER_ERROR.into_response()
}

let app = Router::new().route("/quote", get(quote)).layer(
    ServiceBuilder::new()
        .layer(HandleErrorLayer::new(handle_deadline))
        .layer(tower::timeout::TimeoutLayer::new(Duration::from_millis(500))),
);
```

## Tradeoffs and assumptions

Enable Tower's `timeout` feature if this stack already uses the layer; `BoxError` is `tower::BoxError`. This deadline polls the response future and does not constrain readiness waits outside that future or body frames after it resolves. A gateway waiting on an upstream may choose 504 instead. Dropping the future does not undo committed effects or cancel detached jobs; a write API should not present a timeout as proof that retrying is safe.

## Verification

Inject a pending handler or dependency and check the assembled service returns the configured 503 and body rather than a service error. Confirm a prompt handler still succeeds. With a drop probe on the pending handler's future, verify timeout releases it; if the route starts a detached job, verify its lifetime separately.
