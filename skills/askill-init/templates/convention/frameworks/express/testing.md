# Mounted-stack testing

**Invariant:** The test calls the real mount and verifies both its transport result and the resulting write or absence of a write.

The Supertest assertions apply to Express 4.x and 5.x when the app is created with the installed major's actual middleware and registration. Keep fixture expectations at the HTTP and persistence boundary, not at Express's parser or router internals.

**Assumptions:** `createApp` constructs production mounts without listening. The repo uses Supertest and an isolated order store. `verifyCredential` resolves a principal for the fixture bearer token; keep the middleware that calls it active.

Use request tests to prove actual matching, parser and auth order, status mapping and writes. Swap only external boundaries necessary for determinism. A raw handler invocation is not a substitute for a test of the mounted stack.

## Bad

```js
await createOrderHandler({ body: { quantity: 2 } }, fakeResponse, fakeNext);
expect(fakeResponse.status).toHaveBeenCalledWith(201);
```

## Good

```js
const app = createApp({ orderStore, verifyCredential });
const path = '/api/orders';
await request(app).post(path).send({ quantity: 2 }).expect(401);
expect(await orderStore.count()).toBe(0);
await request(app).post(path).set('Authorization', 'Bearer fixture')
  .send({ quantity: 'two' }).expect(400);
expect(await orderStore.count()).toBe(0);
const created = await request(app).post(path).set('Authorization', 'Bearer fixture')
  .send({ quantity: 2 }).expect(201);
expect(await orderStore.get(created.body.id)).toMatchObject({ quantity: 2 });
```

An isolated spy can pass when production mounted the handler at the wrong prefix or before auth. Readback catches a handler that produces a success response but skips the write.

**Exception:** Test pure mapping rules directly or add handler tests for complicated branches, alongside at least one mounted failure and success per changed route. Test database constraints using the real database engine, not the fixture store.

## Verification

1. Run these cases at the real mount, then add malformed JSON and an unknown path to distinguish parser failure from 404.
2. Inject an unexpected store error and assert the safe body plus no apparent success. Check the test fails if admission middleware is removed.
3. Use fresh fixtures per test; close any owned server, store or connection so failures do not leak state into later tests.
