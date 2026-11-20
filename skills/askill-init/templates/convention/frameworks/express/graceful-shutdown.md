# Graceful shutdown

**Invariant:** Shutdown stops admitting work, lets admitted requests finish before closing their dependencies, and exits within a bounded time if draining gets stuck.

The Express admission gate is portable across 4.x and 5.x; idle keep-alive draining depends on Node's HTTP server, not Express. This recipe covers Node 18.2.0–18.x and Node 19+. [Node's HTTP history](https://nodejs.org/api/http.html#serverclosecallback) identifies the change at 19.0.0.

## When to read

Change signal handling, readiness checks, or how an Express process drains during rollout.

**Assumptions:** A plain Node HTTP server, no upgraded sockets, and a supervisor that allows more than the example's 20-second deadline. Requests are bounded; this process owns one database pool and no independent background workers.

Mark the instance unready and stop admitting new work. Stop accepting new connections; wait for admitted requests to finish before closing their dependencies. Give the whole drain a bounded deadline, including dependency cleanup.

## Bad

```js
process.on('SIGTERM', () => {
  void pool.end();
  process.exit(0);
});
```

## Good

```js
let draining = false;
app.get('/ready', (_req, res) => res.sendStatus(draining ? 503 : 200));
app.use((_req, res, next) => {
  if (draining) return res.status(503).set('Connection', 'close').end();
  next();
});
app.use(apiRouter);
const server = app.listen(port);

async function shutdown() {
  if (draining) return;
  draining = true;
  const deadline = setTimeout(() => {
    logger.error('shutdown deadline exceeded');
    process.exit(1);
  }, 20_000);
  try {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      // Node 18.2.0–18.x: add server.closeIdleConnections() on this line.
    });
    await pool.end();
    clearTimeout(deadline);
  } catch (error) {
    logger.error('shutdown failed', safeErrorFields(error));
    process.exitCode = 1;
    deadline.unref(); // still enforce the deadline if failed cleanup leaves handles alive
  }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

On Node 18.2.0–18.x, call [`server.closeIdleConnections()`](https://nodejs.org/api/http.html#servercloseidleconnections) immediately after starting `server.close()` to reap already-idle keep-alive sockets without racing newly accepted connections. On Node 19+, `server.close()` already reaps idle connections; leave out the extra call. After listener closure begins, a new connection may be refused rather than see `503`. If ingress needs a propagation interval, mark unready and reject new work during that interval, inside the deadline. WebSocket upgrades and independent workers need their own drain and close contracts.

## Verification

1. Hold a request at a database gate; signal the server and confirm new requests are refused or rejected while the admitted request can finish. Assert the pool closes after that response and the process exits normally.
2. Signal twice during the gate and confirm cleanup runs once. In a subprocess, simulate stuck work or stuck cleanup and assert the deadline produces a bounded nonzero exit.
3. In either Node branch, keep a separate HTTP keep-alive connection idle at the signal and verify it closes without waiting for its keep-alive timeout or interrupting the gated request.
