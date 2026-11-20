# Testing Axum

## When to read

Read when changing a mounted route, an extractor, middleware, error conversion, or the side effects of an HTTP operation.

## Exercise the assembled router through `oneshot`

**Wrong —** a direct call constructs already-extracted inputs and bypasses routing, rejection, and middleware.

```rust
let body = Json(CreateBody { name: "dial".into() });
let status = create(State(state), body).await.unwrap();
assert_eq!(status, StatusCode::CREATED);
```

**Right —** build the production router with fake state and send an HTTP request. Use `tower::ServiceExt` with the Tower `util` feature.

```rust
#[tokio::test]
async fn create_widget_malformed_json_rejects_without_write() {
    let (state, writes) = recording_state();
    let app = build_router(state);
    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/widgets")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, "Bearer test-token")
        .body(Body::from(r#"{"name":"#))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_error_code(response, "invalid_widget_body").await;
    assert_eq!(writes.load(Ordering::SeqCst), 0);
}
```

`Request` can be `axum::http::Request`, with the builder body specifying `Body`. Configure the fixture to accept the specified credential, so the request reaches JSON extraction. Clone the assembled router before `oneshot` when a scenario needs more than one request; it consumes the service value.

## Assert the wire representation with a finite body budget

**Wrong —** the success status alone cannot detect the wrong response type or a missing public field.

```rust
assert_eq!(response.status(), StatusCode::OK);
```

**Right —** read response metadata before consuming the body. Decode the body and assert the stable contract, not JSON key order.

```rust
assert_eq!(response.status(), StatusCode::OK);
let media_type = response.headers()[header::CONTENT_TYPE].to_str().unwrap();
assert_eq!(media_type.split(';').next().unwrap(), "application/json");
let bytes = axum::body::to_bytes(response.into_body(), 16 * 1024)
    .await
    .expect("response must fit the expected widget response budget");
let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
assert_eq!(payload["id"], serde_json::json!(42));
```

For a pending response such as a stream, test bounded receipt of frames instead of collecting the whole stream. A byte limit alone cannot time out an idle body.

## Exceptions and tradeoffs

Keep unit tests for pure operations or error mappings; do not count them as evidence of router wiring. Use a real listener when verifying TLS, disconnect propagation, or flush timing. Request fakes should model failures and record effects without depending on unrelated mock-call order.

## Verification and pass criteria

Run `cargo test` for the server crate. Cover valid input, extraction failure, authorization denial, and a domain failure using the mounted path; verify exact status, documented headers and body, one intended effect on success, and zero committed effects on rejected requests. To check the regression test is meaningful, temporarily break the boundary mapping or guard and confirm that its test fails before restoring it.
