# Request-scoped resources

**Invariant:** Disconnect signals cancellation, but a checked-out lease is released exactly once and only after the last operation using it has settled.

The lifecycle applies to Express 4.x and 5.x on a Node runtime with `AbortController` and [`ServerResponse.writableFinished`](https://nodejs.org/api/http.html#responsewritablefinished). On 4.x register `app.get('/summary', forwardAsync(requireActor), forwardAsync(readSummary))` with the [explicit forwarding adapter](errors-and-responses.md#good); on 5.x register the async functions directly as below ([Express promise forwarding](https://expressjs.com/en/guide/migrating-5.html#rejected-promises-handled-from-middleware-and-handlers)).

## When to read

Borrow a connection or lease for a request that can disconnect before acquisition or work completes.

**Assumptions:** This is a read-only query; `querySummary` accepts a cancellation signal and settles only after it stops using the leased connection. `release()` returns a healthy lease or discards an unusable one without throwing.

Register disconnect handling before the first wait. Signal cancellation on an early response close, but return the resource only once dependent work has settled. Release in the same scope as acquisition on all exits; a socket event does not prove a database query has stopped.

## Bad

```js
async function readSummary(_req, res) {
  const lease = await pool.acquire();
  res.once('close', () => lease.release());
  return res.json(await lease.querySummary(res.locals.actor.id));
}
```

## Good

```js
async function readSummary(_req, res) {
  if (res.destroyed) return; // The client may have disconnected during authentication.
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
}
app.get('/summary', requireActor, readSummary);
```

`isCancelledOperation` recognizes the adapter's expected abort error only. If a driver cannot cancel, use a bounded query deadline and still wait for settlement before recycling the connection. For writes, a client disconnect does not tell you whether a transaction committed; define retry semantics separately.

## Verification

1. Disconnect a real HTTP client while acquisition is pending and while a query is in flight. Assert cancellation is signaled, any late lease is released once, and the pool does not make a still-busy lease available.
2. Exercise success and an unexpected query rejection with either mounted registration. Assert the success or exactly one mapped error response, and confirm a subsequent request can borrow from a pool of size one.
