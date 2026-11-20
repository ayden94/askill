# Resource authorization

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

## Verification

Use two tenants with real persisted orders. As the second tenant, attempt to edit the first order; assert the documented response and that its stored value is unchanged. Repeat as an authorized actor and verify exactly one change.
