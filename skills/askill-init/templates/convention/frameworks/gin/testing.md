# Testing Gin

**Invariant:** A route-contract test crosses the production router with realistic wire input and measures effects.

**Compatibility:** Stable Gin 1.x `ServeHTTP` with Go [`httptest`](https://pkg.go.dev/net/http/httptest); `httptest.NewRecorder` does not establish real socket or proxy behavior. `req.WithContext(ctx)` avoids requiring Go 1.23's `httptest.NewRequestWithContext`.

**Acceptance check:** A malformed authenticated request reaches binding, produces the exact public error and performs zero writes; separately confirm cancellation with an entry/release handshake.

## When to read

Read when changing route registration, middleware, validation, response contracts, or request lifetime behavior.

## Test the configured router, not a handler in isolation

**Wrong —** a synthetic context and a direct handler invocation skip route matching and guards.

```go
w := httptest.NewRecorder()
c, _ := gin.CreateTestContext(w)
createWidget(c)
```

**Right —** call `ServeHTTP` on the production router factory with controlled dependencies. This example assumes the fixture grants access with the supplied test token.

```go
func TestCreateWidget_MalformedJSON_RejectsWithoutWrite(t *testing.T) {
    store := &recordingWidgetStore{}
    r := newRouter(store)
    w := httptest.NewRecorder()
    req := httptest.NewRequest(http.MethodPost, "/v1/widgets", strings.NewReader(`{"name":`))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer test-token")

    r.ServeHTTP(w, req)

    res := w.Result()
    defer res.Body.Close()
    if res.StatusCode != http.StatusBadRequest || store.writes != 0 {
        t.Fatalf("status=%d writes=%d", res.StatusCode, store.writes)
    }
    assertJSONCode(t, res, "invalid_widget")
}
```

Have `assertJSONCode` check the media type, decode the body, and require EOF after the expected document. The status alone could come from an unrelated middleware failure.

## Synchronize cancellation with the operation being tested

**Wrong —** sleeping cannot establish that the handler has entered the dependency.

```go
go r.ServeHTTP(w, req)
time.Sleep(10 * time.Millisecond)
cancel()
```

**Right —** inject a store that signals `entered` before blocking on the request context; inspect the recorder only after completion.

```go
done := make(chan struct{})
defer cancel()
go func() {
    defer close(done)
    r.ServeHTTP(w, req.WithContext(ctx))
}()
awaitSignal(t, entered, time.Second)
cancel()
awaitSignal(t, done, time.Second)
```

Here `awaitSignal` is a test helper that selects between the signal and a timer and fails the test on timeout. A completed handler is not enough if detached workers can remain alive; add a separate release signal from any resource-owning goroutine.

## Exceptions and tradeoffs

Use direct unit tests for pure parsing or service policy, not as proof of router wiring. Use `httptest.NewServer` or the deployed stack when validating real disconnects, flush timing, or reverse-proxy behavior. Keep recorder and fake state per test; do not toggle Gin's global mode in parallel tests.

## Verification and pass criteria

Run `go test ./...` and `go test -race ./...` where supported. For a new write route cover valid, bad payload, and denied requests: verify documented status, content type and body, one expected write on success, and zero writes on each rejection. A cancellation test passes only when all required release signals arrive before the deadline. To validate the regression test, temporarily break its guarded behavior and confirm the relevant assertion fails before restoring it.
