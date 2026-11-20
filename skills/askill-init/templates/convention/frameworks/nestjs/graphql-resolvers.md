# GraphQL resolvers and request scope

**Read when:** Only when GraphQL schema, resolver execution, field authorization, or batching changes.

## Decision

Treat input and output types as a public schema. A resolver should translate a field request into an authorized use case. Parent authorization does not automatically grant access to every nested field. Avoid one remote lookup per parent when resolving lists.

## Bad

```ts
async owner(order: Order) {
  return this.users.findById(order.ownerId); // repeats per order
}
```

## Good

```ts
async owner(order: Order, ctx: RequestContext) {
  return ctx.visibleOwners.load(order.ownerId);
}
```

## Assumptions and exceptions

Assume visibleOwners is created per authenticated request and batches only authorized records. A process-wide cache keyed by user ID can return data from another tenant. Match missing-field behavior to schema nullability and keep field errors distinct from request rejection.

## Verification

Execute a real query over multiple orders, including shared owner IDs. Check the result and backing call count; repeat with another tenant and verify that cached values do not cross requests. Test partial errors against the actual schema, not just direct resolver calls.
