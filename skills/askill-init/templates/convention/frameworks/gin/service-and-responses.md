# Service and response boundaries

**Invariant:** Request-required work uses the request lifetime and each outcome writes one public response.

**Compatibility:** Stable Gin 1.x transport pattern; use [Go's incoming request context](https://pkg.go.dev/net/http#Request.Context), not `*gin.Context`, as the cancellation contract. The wrapped-error example needs Go 1.13+ [`errors.Is`](https://go.dev/doc/go1.13#error_wrapping) and a compatible Gin pin.

**Acceptance check:** Cancel after the dependency starts and observe resource release; wrapped not-found and unexpected failures each produce exactly one documented response without internal diagnostics.

## When to read

Read when adding service calls, deadlines, error mappings, or background work to a Gin endpoint.

## Propagate the HTTP request lifetime

**Wrong —** a background context drops disconnect and upstream timeout signals. Passing the whole Gin context into the store also hands transport state to persistence.

```go
func (h handler) show(c *gin.Context) {
    widget, err := h.store.Find(context.Background(), c)
    writeWidget(c, widget, err)
}
```

**Right —** parse the transport value at the edge, then pass a standard context plus a domain input.

```go
func (h handler) show(c *gin.Context) {
    id, err := strconv.ParseUint(c.Param("id"), 10, 64)
    if err != nil || id == 0 {
        c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_id"})
        return
    }
    ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
    defer cancel()
    widget, err := h.store.Find(ctx, id)
    writeWidget(c, widget, err)
}
```

The timeout is an example budget, not a default. The store must use context-aware calls or cancellation still cannot stop blocking I/O.

## Map typed failures before writing a response

**Wrong —** writing an error without returning commits the first response and can append a second JSON document. Returning the internal error text also makes implementation details part of the contract.

```go
if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
}
c.JSON(http.StatusOK, widget)
```

**Right —** select one outcome and explicitly handle unexpected failures.

```go
switch {
case err == nil:
    c.JSON(http.StatusOK, widget)
case errors.Is(err, ErrWidgetNotFound):
    c.JSON(http.StatusNotFound, gin.H{"code": "widget_not_found"})
default:
    logWidgetFailure(c.Request.Context(), err)
    c.JSON(http.StatusInternalServerError, gin.H{"code": "internal_error"})
}
```

`errors.Is` preserves classification through wrapping. Keep internal diagnostics in logs rather than the response; use a transport DTO when the domain object has nonpublic fields or a different wire shape.

## Exceptions and tradeoffs

Map dependency timeouts separately if the API promises a distinct retryable response. A disconnected client cannot depend on receiving one. Long-lived streams need a stream-specific budget and cleanup path, not a short RPC timeout. For durable post-response work, submit a job with copied values to an application-owned queue; do not capture `*gin.Context` in a goroutine. `Context.Copy()` is for accessing copied request context data, not for writing a response after the handler returns or providing a new cancellation lifetime.

## Verification and pass criteria

Inject a fake that announces entry and blocks on `ctx.Done()`. Issue a cancelable request, wait for entry, cancel, and use a bounded wait for the fake and handler to exit. Pass when the fake observes cancellation and releases its resource. Separately inject wrapped not-found and unexpected errors; each must yield its documented status and exactly one JSON document, and the unexpected error text must not appear in that document.
