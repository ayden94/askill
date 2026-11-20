# Request-scoped resources

## When to read

Borrow a connection or lease for a request that can disconnect before acquisition or work completes.

**Assumptions:** Express 5 and Node HTTP. This is a read-only query; `querySummary` accepts a cancellation signal and settles only after it stops using the leased connection. `release()` returns a healthy lease or discards an unusable one without throwing.

Register disconnect handling before the first wait. Signal cancellation on an early response close, but return the resource only once dependent work has settled. Release in the same scope as acquisition on all exits; a socket event does not prove a database query has stopped.

## Bad

```js
const lease = await pool.acquire();
res.once('close', () => lease.release());
return res.json(await lease.querySummary(res.locals.actor.id));
```

## Good

```js
app.get('/summary', requireActor, async (_req, res) => {
  const work = new AbortController();
  const onClose = () => {
    if (!res.writableFinished) work.abort();
  };
  res.once('close', onClose);
  let lease;
  try {
    lease = await pool.acquire({ signal: work.signal });
    if (work.signal.aborted) return;
    const summary = await lease.querySummary(res.locals.actor.id, { signal: work.signal });
    if (!work.signal.aborted) return res.json(summary);
  } catch (error) {
    if (!work.signal.aborted || !isCancelledOperation(error)) throw error;
  } finally {
    res.off('close', onClose);
    lease?.release();
  }
});
```

`isCancelledOperation` recognizes the adapter's expected abort error only. If a driver cannot cancel, use a bounded query deadline and still wait for settlement before recycling the connection. For writes, a client disconnect does not tell you whether a transaction committed; define retry semantics separately.

## Verification

1. Disconnect a real HTTP client while acquisition is pending and while a query is in flight. Assert cancellation is signaled, any late lease is released once, and the pool does not make a still-busy lease available.
2. Exercise success and an unexpected query failure with the mounted handler. Assert the success or mapped error response, and confirm a subsequent request can borrow from a pool of size one.
