# Error mapping and diagnostics

**Invariant:** Expected absence and unexpected dependency failure produce different safe public outcomes; an unexpected failure produces one actionable, correlated diagnostic without leaking secrets.

**Compatibility:** The repository example is unchanged by Nest or adapter versions. For an HTTP filter, reply through `HttpAdapterHost.httpAdapter.reply` rather than assuming Express `res.json()` or Fastify `reply.send()`. `NotFoundException` forwards its `errorCode` option into the body starting at Nest 12.0.2; positional structured logger params start at 12.0.0.

**Read when:** Changing exception filters, public errors, request logging or tracing.

## Decision

Translate expected domain outcomes at a single boundary. An absent record and an unreachable datastore are not the same outcome. Log an unexpected failure once with useful operation context; avoid logging request bodies, credentials, or raw customer records.

## Bad

```ts
try { return await repo.get(id); }
catch { throw new NotFoundException(); }
```

## Good

```ts
const order = await repo.find(id); // infrastructure failures propagate
if (!order) throw new OrderNotFound(id);
return order;
```

## Assumptions and exceptions

Map `OrderNotFound` to the public not-found response in the existing [filter or adapter](https://docs.nestjs.com/exception-filters). Unexpected errors use the established server-error mapping and sanitized diagnostic context. Do not turn ordinary, expected validation failures into high-severity incidents.

- **Public error code, Nest 10 through 12.0.1:** use `new NotFoundException({ statusCode: 404, message: 'Order not found', error: 'Not Found', errorCode: 'ORDER_NOT_FOUND' })`. Even in [12.0.1](https://github.com/nestjs/nest/blob/v12.0.1/packages/common/exceptions/not-found.exception.ts), the constructor accepts the option but does not forward it when building the body.
- **Public error code, Nest 12.0.2–12.x:** `new NotFoundException('Order not found', { errorCode: 'ORDER_NOT_FOUND' })` emits the same fields through the built-in exception mapping. See the [12.0.2 constructor](https://github.com/nestjs/nest/blob/v12.0.2/packages/common/exceptions/not-found.exception.ts). If the existing contract differs, keep its explicit body.
- **One diagnostic, Nest 10–11 versus 12.x:** on 10–11 pass one sanitized event object to the configured logger. On 12.x, `ConsoleLogger` in JSON mode attaches a plain object after the message to that entry under `params` by default. Keep the old formatter or map the fields explicitly if the sink requires the same record shape. See [structured logging params](https://docs.nestjs.com/application/logger#structured-logging-params).

## Verification

On either branch, exercise an unknown ID and a simulated repository outage separately. Assert the exact documented status, body and error code (if part of the contract), and exactly one outage record with the usable correlation identifier at the sink. Check that neither public body nor captured logs contain credential values.
