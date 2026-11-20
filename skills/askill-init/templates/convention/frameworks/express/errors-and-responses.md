# Errors and response ownership

**Assumptions:** This JSON API documents `409 ORDER_CONFLICT` for a typed `OrderConflict` and a generic `500` otherwise. Logging is internal and redacted. The normal route stack precedes the error middleware.

One path sends or delegates; return after either. In Express 5, the router forwards rejections from a returned promise (including an `async` handler); Express 4 requires explicit forwarding for async handlers. Neither automatically catches a detached callback or promise. Register four-argument error middleware, map known errors by their application types, and delegate if headers are already sent.

## Bad

```js
app.post('/orders', (_req, res) => {
  createOrder().then(order => res.status(201).json(order));
});
app.use((err, _req, res, _next) => res.status(500).json({ detail: err.message }));
```

## Good

```js
// Portable Express 4/5 form: forward exactly once.
app.post('/orders', (_req, res, next) => {
  Promise.resolve()
    .then(() => createOrder())
    .then(order => res.status(201).json({ id: order.id }))
    .catch(next);
});
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

**Exception:** With Express 5 confirmed, use a plain `async` route without a compatibility wrapper. For streaming, keep a dedicated stream lifetime, propagate stream failure and release resources on disconnect rather than promising the ordinary JSON error envelope after headers.

## Verification

1. Force a typed conflict and an unexpected rejection. Assert each status and body; neither response should expose stack traces, SQL or credentials.
2. Force a synchronous throw; assert the same unexpected-error contract and exactly one response or delegation.
3. If streaming is supported, induce failure after the first chunk and verify termination and cleanup instead of a second write.
