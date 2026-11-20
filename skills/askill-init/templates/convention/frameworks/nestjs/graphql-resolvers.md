# GraphQL resolvers and request scope

**Invariant:** Each field returns only data visible to the current actor, batches lookups within a request, and preserves the schema's nullability and error behavior.

**Compatibility:** The loader example uses an application-owned request context, not Nest request-scoped DI or a particular loader library. The `@nestjs/graphql` adapter requires the appropriate driver and platform integration; Apollo and Mercurius do not share a native context shape.

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
@ResolveField('owner')
async owner(@Parent() order: Order, @Context() ctx: RequestContext) {
  return ctx.visibleOwners.load(order.ownerId);
}
```

## Assumptions and exceptions

The snippet assumes a schema-first resolver with `owner` declared in the schema and `ResolveField`, `Parent` and `Context` imported from `@nestjs/graphql`. In code-first resolvers, declare the result type and nullability via `@ResolveField` options. Build `visibleOwners` per authenticated execution context and constrain batch queries by the actor; never share a process-wide loader keyed only by user ID. Match missing values and errors to schema nullability. Nest [does not run guards, interceptors, or filters for `@ResolveField` by default](https://docs.nestjs.com/graphql/other-features#execute-enhancers-at-the-field-resolver-level); enforce visibility in the loader/use case rather than relying on a top-level guard to authorize the field.

### Driver and subscription boundaries

- **`@nestjs/graphql` 9.x:** an existing Apollo project configures `GraphQLModule.forRoot({ … })` without a `driver` option. **10–14.x:** configure `GraphQLModule.forRoot<ApolloDriverConfig>({ driver: ApolloDriver, … })` with a compatible `@nestjs/apollo`, or `MercuriusDriver` from `@nestjs/mercurius` for Mercurius/Fastify. The [10.0.0 module](https://github.com/nestjs/graphql/blob/v10.0.0/packages/graphql/lib/graphql.module.ts) rejects missing `driver`; see the [driver setup](https://docs.nestjs.com/graphql/quick-start) for platform-specific peers. Supply the same actor and loader to the resolver whichever driver starts it.
- **Apollo subscriptions only:** **13.x** supports `subscriptions: { 'subscriptions-transport-ws': true }` for existing legacy clients and also supports `graphql-ws`. **14.x** removes the legacy transport: set `subscriptions: { 'graphql-ws': true }` and move clients to the matching protocol. Do not treat a connection-wide loader as a per-execution authorization cache. See the [14.0.0 release](https://github.com/nestjs/graphql/releases/tag/v14.0.0).

## Verification

On either setup, execute a real query over multiple orders with shared owner IDs. Assert the same authorized result and batched backing call, then repeat with another tenant and confirm no cached values cross requests. Check partial errors against the actual schema. If subscriptions changed, verify that an authorized subscriber receives the documented event and an unauthorized subscriber receives no protected payload on both supported client/server pairs.
