# Tower layer ordering

**Invariant:** An outer producer makes request metadata available to inner layers, and an outer observer sees inner early responses.

**Compatibility:** Stable [Tower `ServiceBuilder` order](https://docs.rs/tower/0.5.2/tower/builder/struct.ServiceBuilder.html#order) versus nested Axum `Router::layer` order. The ordering does not change; Axum's `from_fn` signature changes at 0.7.

**Acceptance check:** Success and inner-guard rejection each produce one record with the expected ID and status; reversing producer and observer makes the test fail.

## When to read

Read when one layer needs another's request extension or must observe its early responses.

## Put producers outside their consumers

**Wrong —** sequential `Router::layer` calls put the last layer on the outside. The observer here looks for a correlation ID before the producer can insert it.

```rust
let app = routes
    .layer(middleware::from_fn(add_request_id))
    .layer(middleware::from_fn(observe_request));
```

**Right —** use one `ServiceBuilder` stack in request order. This lets the observer read the ID before the handler runs and record even an early response from an inner guard.

```rust
let app = routes.layer(
    ServiceBuilder::new()
        .layer(middleware::from_fn(add_request_id))
        .layer(middleware::from_fn(observe_request)),
);

async fn observe_request(req: Request, next: Next) -> Response {
    let id = req.extensions().get::<RequestId>().cloned();
    let response = next.run(req).await;
    record_outcome(id.as_ref(), response.status());
    response
}
```

- **Axum 0.6.x:** Use [`from_fn` with `Request<B>` and `Next<B>`](https://docs.rs/axum/0.6.20/axum/middleware/fn.from_fn.html), e.g. `async fn observe_request<B>(req: axum::http::Request<B>, next: Next<B>) -> Response`; keep the body above.
- **Axum 0.7.x–0.8.x:** Use [`axum::extract::Request` and `Next` without a body type parameter](https://docs.rs/axum/0.7.0/axum/middleware/fn.from_fn.html) as shown.

## Tradeoffs and assumptions

The local `add_request_id` inserts a trusted `RequestId` and delegates. Register `routes` (and any guard it owns) before applying this stack. Requests run outer-to-inner; responses return inner-to-outer. Choose layer scope separately from order: a route-only observer need not see fallback traffic, and response status at this boundary is not evidence that a streamed body completed.

## Verification

Build the production router with a recording observer. Send a success and an inner-guard rejection and assert exactly one record per request with a populated ID and the returned status. Reverse the builder order in a temporary test variant and verify the test detects the missing ID.
