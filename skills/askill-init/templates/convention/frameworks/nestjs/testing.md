# Unit, module and HTTP verification

**Assumptions:** The Nest app shown uses the Express adapter, `@nestjs/testing`, and Supertest. `configureHttp` is shared with production and enables the real prefix, pipes and filters; the guard is real and the test replaces only the credential verifier. Fixtures start from an empty isolated store.

Unit-test decision logic without Nest. Use `Test.createTestingModule` to test real imports, exports and tokens; override only external providers. Initialize an app for middleware, guards, pipes, serialization and exception filters. Compiling a module alone does not run the HTTP pipeline.

## Bad

```ts
const controller = new OrdersController(placeOrderStub);
await controller.create(actor, { quantity: 0 });
expect(placeOrderStub.execute).toHaveBeenCalled();
```

## Good

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(CREDENTIAL_VERIFIER).useValue(fixtureVerifier)
  .compile();
const app = moduleRef.createNestApplication();
try {
  configureHttp(app);
  await app.init();
  const api = request(app.getHttpServer());
  await api.post('/api/orders').send({ quantity: 2 }).expect(401);
  await api.post('/api/orders').set('Authorization', 'Bearer fixture')
    .send({ quantity: 0 }).expect(400);
  expect(await store.count()).toBe(0);
  const created = await api.post('/api/orders').set('Authorization', 'Bearer fixture')
    .send({ quantity: 2 }).expect(201);
  expect(await store.get(created.body.id)).toMatchObject({ quantity: 2 });
} finally {
  await app.close();
}
```

A positive direct controller call does not detect a missing guard, pipe, mount, or persistence write. Bypass bootstrap globals only if they are irrelevant to the assertion. Close any test-owned store or worker separately if the app does not own it. With Fastify, create the app with `FastifyAdapter`, initialize it, wait for the underlying instance to be ready, and use injection or the project's matching client.

**Exception:** Direct construction is right for a pure use-case branch. For request-scoped providers use scope-aware resolution with the appropriate request context or exercise them over HTTP; do not use a singleton `get()` assertion as a scope test.

## Verification

1. Unit: invoke the real use case with an ineligible actor; assert a typed refusal and no call to the write boundary.
2. Module: import the real consumer module and substitute the persistence token, not the exported use case. Compile, resolve the consumer and exercise its operation; close the module.
3. HTTP: run the examples through the production-style bootstrap; add an unexpected adapter failure, assert the safe error body, and check that the spec fails when a guard, pipe or error mapping is omitted.
