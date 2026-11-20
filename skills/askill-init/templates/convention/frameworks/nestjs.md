# NestJS

## Modules and dependencies

Group providers by the capability they own. An orders module can export `PlaceOrder` without exposing its ORM repository or every internal helper. Export only what another module actually calls. If two modules require each other, first inspect which workflow owns the joint operation; do not make every provider global or reach for `forwardRef` just to silence a cycle.

Inject dependencies through constructors. Use a stable provider token when substituting an external client or a persistence adapter; TypeScript interfaces do not exist as runtime injection tokens. A stateless helper does not need its own module, interface, and injectable class. Keep request-specific values out of singleton fields: pass the principal or correlation ID explicitly when that is simpler than request scope.

## Request and data boundaries

- Controllers translate transport inputs and outputs. A handler can call `placeOrder.execute(actor, command)`; the use case decides whether the actor may place this order and whether inventory permits it. Do not duplicate these checks across HTTP routes and background jobs.
- Treat request DTOs, persisted entities, and response representations as different contracts. Map allowed fields explicitly rather than persisting an entire request body or serializing an entity that contains private fields.
- Validate inputs with the project's configured pipes and DTO strategy. With decorator-based validation, use concrete DTO classes where runtime metadata is needed. Confirm the actual behavior of transformation, nested inputs, unknown fields, and missing values instead of assuming the type annotation validates JSON.
- Use guards for route admission, pipes for argument validation, and filters for transport error mapping. Keep resource-level decisions near the use case. Preserve internal error causes for diagnostics, but return the documented error shape rather than raw database exceptions.

## Failure and concurrency

Define who owns the transaction for a multi-write use case. A failed inventory reservation must not leave a confirmed order. Defer externally visible notifications until persistence succeeds, using the project's established delivery mechanism. If retries are supported, specify the idempotency key, duplicate outcome, and recovery path; a retry decorator alone does not make a write safe.

## Verification

1. Test domain decisions without booting Nest when dependency injection adds no behavior to the case. Cover rejection and ensure no side effect escapes a rejected decision.
2. Use `Test.createTestingModule` when provider wiring, tokens, guards, or module exports are the contract. Override the external adapter rather than mocking every method in the application.
3. For a changed route, initialize a test application with the **same relevant global configuration** as production. Exercise it through the configured HTTP adapter. A direct controller call cannot prove that guards, pipes, serialization, or status mapping ran.
4. For example, send an invalid quantity through the real route: assert the documented client error and no persisted order. Then submit a valid request and read back the saved state. Close the app and any owned database or worker resources.

For review, identify the public module interface, the use case that owns each decision, and the check that would catch a missing guard, validation rule, or transaction boundary. Prefer a small focused module over adding layers solely to match a diagram.
