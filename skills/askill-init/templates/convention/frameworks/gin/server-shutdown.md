# Server shutdown

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

## Tradeoffs and assumptions

The owner provides an already bound listener and a signal-derived `stop` context. The drain context starts fresh because `stop` is already canceled. Keep dependencies alive through normal drain; forced close is a fallback, not proof that non-cooperative handlers have stopped. Upgraded or hijacked connections need separate tracking. Fit readiness withdrawal, drain and final cleanup within the platform's termination budget.

## Verification

On a real listener, block a handler after it enters, signal shutdown, and release the handler before the deadline. Assert it completes and no new connections are accepted. Repeat with a held request and a short drain budget; assert a timeout is reported and the connection closes. Verify dependency cleanup runs after normal handler completion.
