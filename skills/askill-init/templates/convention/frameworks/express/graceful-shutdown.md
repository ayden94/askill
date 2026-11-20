# Graceful shutdown

## When to read

Change signal handling, readiness checks, or how an Express process drains during rollout.

**Assumptions:** Node.js 19+ with a plain HTTP server, no upgraded sockets, and a supervisor that allows more than the example's 20-second deadline. Requests are bounded; this process owns one database pool and no independent background workers.

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

After listener closure begins, a new connection may be refused rather than see `503`. If ingress needs a propagation interval, mark unready and reject new work during that interval, inside the deadline. Older Node versions may need explicit idle-connection handling; WebSocket upgrades and independent workers need their own drain and close contracts.

## Verification

1. Hold a request at a database gate; signal the server and confirm new requests are refused or rejected while the admitted request can finish. Assert the pool closes after that response and the process exits normally.
2. Signal twice during the gate and confirm cleanup runs once. In a subprocess, simulate stuck work or stuck cleanup and assert the deadline produces a bounded nonzero exit.
