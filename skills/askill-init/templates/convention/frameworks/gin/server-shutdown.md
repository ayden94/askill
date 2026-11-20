# Server shutdown

**Invariant:** Stop accepting work, drain accepted requests, then close dependencies they still use.

**Compatibility:** Stable Gin 1.x [`http.Handler` integration](https://pkg.go.dev/github.com/gin-gonic/gin@v1.11.0#Engine.ServeHTTP); shutdown is Go's [`http.Server.Shutdown`](https://pkg.go.dev/net/http#Server.Shutdown), available since Go 1.8. The example's multi-error helper is independently gated by [Go 1.20](https://go.dev/doc/go1.20#errors).

**Acceptance check:** A held request finishes before normal dependency cleanup; after expiry, the forced-close path reports the deadline and closes the connection.

## When to read

Read when adding the process entry point or changing what a deploy does to active requests.

## Drain before releasing dependencies

**Wrong —** closing the listener and active connections together interrupts accepted work, and a client can lose the response to a committed write.

```go
<-stop.Done()
return srv.Close()
```

**Right —** run the Gin router as the handler of an owned `http.Server`. Coordinate listener exit with draining; do not exit just because the serving goroutine returned.

```go
srv := &http.Server{Handler: router, ReadHeaderTimeout: 5 * time.Second}
served := make(chan error, 1)
go func() { served <- srv.Serve(listener) }()

select {
case err := <-served:
    return err
case <-stop.Done():
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(ctx); err != nil {
        return errors.Join(err, srv.Close())
    }
    if err := <-served; !errors.Is(err, http.ErrServerClosed) {
        return err
    }
    return nil
}
```

- **Go 1.20 or newer:** Use `errors.Join` as shown to preserve both the drain and forced-close errors.
- **Go 1.13–1.19, with a compatible Gin pin:** Replace the join with `if closeErr := srv.Close(); closeErr != nil { log.Printf("forced close: %v", closeErr) }; return err`. Preserve the drain failure as the returned error; log the independent close failure. Go 1.13 is the floor of this branch because it retains `errors.Is` elsewhere.

## Tradeoffs and assumptions

The owner provides an already bound listener and a signal-derived `stop` context. The drain context starts fresh because `stop` is already canceled. Keep dependencies alive through normal drain; forced close is a fallback, not proof that non-cooperative handlers have stopped. Upgraded or hijacked connections need separate tracking. Fit readiness withdrawal, drain and final cleanup within the platform's termination budget.

## Verification

On a real listener, block a handler after it enters, signal shutdown, and release the handler before the deadline. Assert it completes and no new connections are accepted. Repeat with a held request and a short drain budget; assert a timeout is reported and the connection closes. Verify dependency cleanup runs after normal handler completion.
