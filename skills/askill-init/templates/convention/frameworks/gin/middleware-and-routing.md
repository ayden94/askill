# Middleware and routing

## When to read

Read when mounting route groups, introducing authentication, or recording the status and latency of a request.

## Put guards on the route group and return after aborting

**Wrong —** adding group middleware after registration does not retrofit it onto existing routes. `AbortWithStatusJSON` also does not stop the current function.

```go
v1 := r.Group("/v1")
v1.POST("/widgets", createWidget)
v1.Use(requireActor)

func requireActor(c *gin.Context) {
    actor, ok := authenticate(c.Request)
    if !ok {
        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "unauthorized"})
    }
    c.Set("actor", actor)
}
```

**Right —** make scope and execution order visible at construction and terminate the rejected branch.

```go
v1 := r.Group("/v1", requireActor)
v1.POST("/widgets", createWidget)
r.GET("/healthz", health)

func requireActor(c *gin.Context) {
    actor, ok := authenticate(c.Request)
    if !ok {
        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "unauthorized"})
        return
    }
    c.Set("actor", actor)
    c.Next()
}
```

The guard establishes identity; resource-level authorization still depends on the actor and target loaded by the operation.

## Measure after the downstream chain runs

**Wrong —** latency and status read before `Next` describe the middleware itself, not the completed response.

```go
func measure(c *gin.Context) {
    start := time.Now()
    record(c.FullPath(), c.Writer.Status(), time.Since(start))
    c.Next()
}
```

**Right —** register the observer outside the routes it must observe, and read final status after downstream returns.

```go
r := gin.New()
r.Use(measure, gin.Recovery())
mountRoutes(r)

func measure(c *gin.Context) {
    start := time.Now()
    c.Next()
    route := c.FullPath()
    if route == "" {
        route = "unmatched"
    }
    record(route, c.Writer.Status(), time.Since(start))
}
```

The route pattern keeps route labels bounded. The observer encloses recovery so it can see the response recovery writes for an uncommitted panic.

## Exceptions and tradeoffs

Use a different policy when routing misses should be logged separately. A recovery handler cannot replace an already committed status after a partial streaming response; record that failure separately. For authentication schemes that require a challenge, write the proper challenge header before aborting. Avoid a second recovery/logger pair if the router already uses `gin.Default()`.

## Verification and pass criteria

Exercise the assembled router with unauthenticated, authenticated, unmatched, and deliberate pre-write panic requests. Pass when the protected handler executes only for the authenticated request, health stays public, and the observer records exactly one entry per request with the actual response status and a bounded route label. Check the challenge header where required.
