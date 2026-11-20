# Request correlation

**Invariant:** The edge owns the request ID, and the response, logs and approved downstream hops agree on it.

**Compatibility:** Stable Gin 1.x middleware plus [standard request context propagation](https://pkg.go.dev/net/http#Request.WithContext); logging adapter choice is independent of Gin. The `log/slog` logger shown requires [Go 1.21](https://go.dev/doc/go1.21#slog).

**Acceptance check:** Reuse one caller-supplied ID across two requests; the edge generates distinct IDs that match their response headers and captured logs, including a guard rejection.

## When to read

Read when joining Gin access events and downstream logs through a request ID.

## Give the ID one owner at the public edge

**Wrong —** using a raw client value as both a correlation key and a metric label permits collisions and unbounded series.

```go
id := c.GetHeader("X-Request-ID")
metrics.Requests.WithLabelValues(id).Inc()
c.Next()
```

**Right —** on a public edge, create the ID before other middleware and propagate it with the standard context. Keep it in logs, not metric labels.

```go
func correlate(c *gin.Context) {
    id := newRequestID()
    c.Header("X-Request-ID", id)
    ctx := withRequestID(c.Request.Context(), id)
    c.Request = c.Request.WithContext(ctx)
    c.Next()
    logger.InfoContext(ctx, "request complete",
        "request_id", id, "status", c.Writer.Status())
}

router.Use(correlate, gin.Recovery())
```

- **Go 1.21 or newer:** Call `logger.InfoContext(ctx, ...)` on a `*slog.Logger` as above.
- **Go before 1.21, with a compatible Gin pin:** Use the project's existing logger with explicit `request_id` and `status` fields, or `log.Printf("request complete request_id=%s status=%d", id, c.Writer.Status())`; keep the same standard request-context propagation.

## Tradeoffs and assumptions

The local `withRequestID` uses a private typed context key and `newRequestID` generates a fresh ID. Downstream clients explicitly map the value to their allowed outbound header. Behind a trusted gateway that normalizes IDs, adopting a validated upstream ID may preserve an existing trace; never use it for identity or access decisions.

## Verification

Send two requests with the same inbound ID, including one rejected by a downstream guard. Assert distinct response IDs and matching log entries, and check the accepted request passes the same ID to its fake gateway. Assert the inbound value never becomes a metric label.
