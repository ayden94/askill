# Graceful shutdown

## When to read

Read when adding the server entry point or coordinating rolling deploys and dependency teardown.

## Signal drain and await it

**Wrong —** selecting the process signal against the server future drops that future on shutdown without waiting for active responses.

```rust
tokio::select! {
    result = axum::serve(listener, app).into_future() => result?,
    _ = shutdown_signal() => {}
}
workers.stop().await?;
```

**Right —** give shutdown ownership to the serving future, and stop application workers that requests rely on only after it completes.

```rust
let result = axum::serve(listener, app)
    .with_graceful_shutdown(shutdown_signal())
    .await;
workers.stop().await?;
result?;
```

## Tradeoffs and assumptions

`shutdown_signal` is a local future that resolves on the platform's stop signal, including SIGTERM on Unix deployments; the wrong example uses `std::future::IntoFuture`. Axum's graceful shutdown does not set a drain deadline. Leave time for readiness withdrawal and cleanup within the supervisor's stop window, and arrange cooperative termination for long-lived streams and separately spawned tasks. Dropping a task handle does not stop its work.

## Verification

On a real listener, hold an in-flight request with a future controlled by the test, initiate shutdown, and confirm new connections stop being served. Release the request and assert its response completes before `workers.stop` runs. Exercise an open stream and verify its shutdown signal lets the server finish before the supervisor's hard kill.
