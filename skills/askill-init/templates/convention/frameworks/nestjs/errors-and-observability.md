# Error mapping and diagnostics

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

Map OrderNotFound to the public not-found response in the existing filter or adapter. Unexpected errors use the established server-error mapping and sanitized diagnostic context. Do not turn ordinary, expected validation failures into high-severity incidents.

## Verification

Exercise an unknown ID and a simulated repository outage separately. Verify different public outcomes, the agreed response shape, and a usable correlation identifier in the outage diagnostic. Check that the public body and captured logs contain no credential values.
