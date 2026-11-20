# Unit, module and HTTP verification

**Invariant:** The HTTP test proves the real application's authentication, runtime validation, response contract, and persistence effects; wiring tests do not stand in for that boundary.

**Compatibility:** `@nestjs/testing` should match the app's Nest major. The shown `request(app.getHttpServer())` uses Supertest with Express; Fastify requires the app's adapter and readiness. The assertions work across test runners, but a runner loading Nest 12's ESM packages must support its module format.

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

A positive direct controller call does not detect a missing guard, pipe, mount, or persistence write. Do not bypass the bootstrap globals whose behavior is under test. Close any test-owned store or worker separately if the app does not own it.

For **Fastify**, use `moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())` (both Fastify types/APIs come from `@nestjs/platform-fastify`); run `configureHttp(app)`, then `await app.init()` and `await app.getHttpAdapter().getInstance().ready()`. Use `app.inject({ method: 'POST', url: '/api/orders', headers, payload })` and assert `statusCode`, the decoded body and the same store effects. Keep the same adapter options and plugins as production. See [Nest end-to-end testing](https://docs.nestjs.com/fundamentals/testing#end-to-end-testing).

- **Nest 10–11:** keep the project's existing compatible runner and module transformer.
- **Nest 12.x:** for the documented Jest path, use a compatible Jest setup on Node **24.9+**, or run the same tests with an ESM-capable runner such as Vitest configured to emit Nest's decorator metadata. An application that boots on Node 20.19 does not prove its Jest suite can load the same packages. See the [Nest 12 testing migration](https://docs.nestjs.com/migration-guide#testing-stack).

**Exception:** Direct construction is right for a pure use-case branch. For request-scoped providers use scope-aware resolution with the appropriate request context or exercise them over HTTP; do not use a singleton `get()` assertion as a scope test.

## Verification

1. Unit: invoke the real use case with an ineligible actor; assert a typed refusal and no call to the write boundary.
2. Module: import the real consumer module and substitute the persistence token, not the exported use case. Compile, resolve the consumer and exercise its operation; close the module.
3. HTTP: on each supported adapter and runner, assert the same `401`, `400`, no writes, and then a `201` with the expected stored quantity and public response. Add an unexpected dependency failure and assert the safe error response; the spec must fail when a guard, pipe or error mapping is omitted.
