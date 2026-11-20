# Errors and response ownership

**Invariant:** Each admitted request sends one response or passes one error to the next owner; after headers are sent, the error path must not attempt another response body.

Four-argument error middleware and `res.headersSent` are portable across Express 4.x and 5.x. A returned rejected promise is not: Express 4.x needs explicit forwarding; Express 5.x automatically forwards the returned rejection ([Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html#rejected-promises-handled-from-middleware-and-handlers)).

**Assumptions:** This JSON API documents `409 ORDER_CONFLICT` for a typed `OrderConflict` and a generic `500` otherwise. Logging is internal and redacted. The normal route stack precedes the error middleware.

One path sends or delegates; return after either. Neither major automatically catches a detached callback or promise. Register four-argument error middleware, map known errors by their application types, and delegate if headers are already sent.

## Bad

```js
app.post('/orders', (_req, res) => {
  createOrder().then(order => res.status(201).json(order));
});
app.use((err, _req, res, _next) => res.status(500).json({ detail: err.message }));
```

## Good

```js
async function postOrder(_req, res) {
  const order = await createOrder();
  return res.status(201).json({ id: order.id });
}

// Express 4.x: wrap each promise-returning middleware or handler.
const forwardAsync = handler => (req, res, next) => {
  void Promise.resolve().then(() => handler(req, res, next)).catch(next);
};
app.post('/orders', forwardAsync(postOrder));

// Express 5.x: replace the registration above with this one.
// app.post('/orders', postOrder);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof OrderConflict) {
    return res.status(409).json({ code: 'ORDER_CONFLICT' });
  }
  reportInternalError(err, req);
  return res.status(500).json({ code: 'INTERNAL' });
});
```

The explicit chain catches synchronous throws inside the callback and asynchronous rejections. Do not call `next(err)` and rethrow the same error in Express 5. Once headers are sent, a second JSON body cannot change the status; delegate instead.

**Exception:** For streaming, keep a dedicated stream lifetime, propagate stream failure and release resources on disconnect rather than promising the ordinary JSON error envelope after headers.

## Verification

1. In either registration, force a typed conflict and an unexpected rejection. Assert exactly one mapped response for each; neither should expose stack traces, SQL or credentials.
2. Force a synchronous throw; assert the same unexpected-error contract and exactly one response or delegation.
3. If streaming is supported, induce failure after the first chunk and verify termination and cleanup instead of a second write.
