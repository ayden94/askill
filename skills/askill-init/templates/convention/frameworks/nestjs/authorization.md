# Resource authorization

**Invariant:** An authenticated actor can mutate only resources the actor is authorized to change; denied writes leave storage unchanged and reveal no more than the disclosure policy permits.

**Compatibility:** `@UseGuards` from `@nestjs/common` gates the HTTP handler on Express and Fastify; it does not scope the datastore write. No Nest-major or adapter branch is needed for the example. `SessionGuard`, the actor and the repository are application code; the store must support the atomic predicate described below.

**Read when:** Changing who may read or update a resource, not merely whether a request is authenticated.

## Decision

A session guard establishes identity. It does not establish ownership of an order named in a route. Carry the trusted actor into the use case; never accept a tenant identifier from the request as proof of membership. Keep the same policy when the operation is invoked from a non-HTTP entry point.

## Bad

```ts
@UseGuards(SessionGuard)
@Patch(':id')
update(@Param('id') id: string, @Body() dto: PatchOrder) {
  return this.orders.update(id, dto); // no actor reaches the write
}
```

## Good

```ts
async update(actor: Actor, id: OrderId, patch: AllowedPatch) {
  const changed = await this.orders.updateInTenant(actor.tenantId, id, patch);
  if (!changed) throw new OrderNotVisible();
}
```

## Assumptions and exceptions

The example assumes a tenant-wide update policy and an atomic tenant-scoped repository write. If only the creator may edit, include that predicate as well. Map not-visible consistently with the project’s disclosure policy; do not leak whether a foreign ID exists.

Resolve the actor from verified credentials, not from the DTO or route. If a custom guard or actor decorator uses native request or session middleware, use the installed adapter's request and session APIs; keep the actor passed into the use case unchanged. Nest's [guard execution context](https://docs.nestjs.com/guards) also works outside HTTP, but an HTTP `switchToHttp()` guard does not authenticate GraphQL or queue jobs.

## Verification

Use two tenants with real persisted orders. As the second tenant, attempt to edit the first order; assert the documented response matches a nonexistent ID where nondisclosure is required, and that the stored value is unchanged. Repeat as an authorized actor and verify exactly one change. Apply the same denial/no-write check to any non-HTTP entry point for this operation.
