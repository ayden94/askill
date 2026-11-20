# Request observability

## When to read

Add access logging or latency metrics that must distinguish completed responses from transport disconnects.

**Assumptions:** Node HTTP, a structured logger and metrics adapter. Route registration supplies bounded labels; request IDs are generated locally and never used as metric dimensions.

Attach lifecycle observers before parsers and routes. Record once at `finish` or at `close` before finish; classify early close as a disconnect rather than interpreting the default status as success. Use a monotonic clock and log approved fields, not request objects, raw URLs, headers or bodies.

## Bad

```js
app.use((req, res, next) => {
  logger.info({ req, status: res.statusCode }, 'request');
  next();
});
```

## Good

```js
app.use((_req, res, next) => {
  const id = randomUUID();
  const started = performance.now();
  res.locals.requestId = id;
  function record(outcome) {
    res.off('finish', onFinish);
    res.off('close', onClose);
    const route = res.locals.routeLabel ?? 'unclassified';
    const elapsedMs = performance.now() - started;
    const status = outcome === 'finished' ? res.statusCode : null;
    metrics.observeRequest({ route, outcome, status }, elapsedMs);
    logger.info({ id, route, outcome, status, elapsedMs }, 'request ended');
  }
  function onFinish() { record('finished'); }
  function onClose() { record('disconnected'); }
  res.once('finish', onFinish);
  res.once('close', onClose);
  next();
});

app.get('/orders/:id', (_req, res, next) => {
  res.locals.routeLabel = 'GET /orders/:id';
  next();
}, readOrder);
```

Node's `finish` says the response was handed off for transmission, not that the client received it. Use stable buckets when no route label is available. For tracing across services, use the established trace context propagation and keep raw identifiers out of metric labels.

## Verification

1. Capture emitted records for a success, mapped error and parser rejection. Assert each has the actual status and exactly one completion record.
2. Close a real client connection while a response is held pending. Assert one disconnected record and no successful completion. Send unique synthetic markers in a query and headers and verify neither markers nor raw per-order paths appear in captured telemetry.
