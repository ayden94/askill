# Tower layer ordering

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

## Tradeoffs and assumptions

The local `add_request_id` inserts a trusted `RequestId` and delegates. Register `routes` (and any guard it owns) before applying this stack. Requests run outer-to-inner; responses return inner-to-outer. Choose layer scope separately from order: a route-only observer need not see fallback traffic, and response status at this boundary is not evidence that a streamed body completed.

## Verification

Build the production router with a recording observer. Send a success and an inner-guard rejection and assert exactly one record per request with a populated ID and the returned status. Reverse the builder order in a temporary test variant and verify the test detects the missing ID.
