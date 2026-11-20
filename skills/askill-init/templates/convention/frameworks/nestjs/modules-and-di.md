# Modules and dependency injection

**Invariant:** A consuming module resolves the owner's exported capability through a single, shared runtime token without registering or depending on the owner's persistence implementation.

**Compatibility:** The singleton `Symbol`/`@Inject` and module import/export pattern is unchanged in Nest 10–12 and independent of Express/Fastify. With Nest 12, however, the build and host must be able to load the framework's ESM packages; optional dependencies in redeclared subclass constructors also behave differently.

**Assumptions:** Orders owns order creation; fulfillment needs to call that capability but does not need direct access to the Orders persistence adapter. The example uses singleton providers and project-configured Nest decorators.

Import the module that owns the capability; export its intended use case or port, not its ORM internals. Inject dependencies in constructors. A TypeScript interface is erased; define the token once in a dependency-light file and use the exact same runtime value for registration and injection. Pass request-specific actors or correlation IDs as method arguments rather than assigning them to singleton fields.

## Bad

```ts
@Module({ imports: [forwardRef(() => FulfillmentModule)],
  providers: [SqlOrders], exports: [SqlOrders] })
export class OrdersModule {}
@Module({ imports: [forwardRef(() => OrdersModule)] })
export class FulfillmentModule {}
```

## Good

```ts
export const ORDER_STORE = Symbol('ORDER_STORE');

@Injectable()
export class PlaceOrder {
  constructor(@Inject(ORDER_STORE) private readonly orders: OrderStore) {}
  execute(actor: Actor, command: PlaceOrderCommand) {
    return this.orders.createFor(actor, command);
  }
}
@Module({
  providers: [PlaceOrder, { provide: ORDER_STORE, useClass: SqlOrders }],
  exports: [PlaceOrder],
})
export class OrdersModule {}
@Module({ imports: [OrdersModule], providers: [FulfillOrder] })
export class FulfillmentModule {}
```

The module import direction shows who depends on whom. When two modules both seem to own a workflow, move orchestration into the actual owner or into a third composition module that imports both. Re-registering the same class in a consuming module can create another instance instead of accessing the exported one.

**Exception:** Use `forwardRef` only for an unavoidable, documented legacy cycle, with an explicit test and no dependence on constructor order. Use request scope only when request-bound lifetime is essential; check scope propagation and test it through independent request contexts. A stateless helper can remain a plain function.

### If the project redeclares an optional injected constructor parameter

- **Nest 10–11:** an existing subclass may rely on `@Optional()` inherited from its parent; prefer declaring the intent locally.
- **Nest 12.x:** on a subclass that redeclares the constructor, explicitly repeat `constructor(@Optional() @Inject(OPTIONS) options?: Options) { super(options); }`. Do not add `@Optional()` to a required dependency to hide a broken module import. This branch concerns redeclared constructors only. See the [optional dependency migration](https://docs.nestjs.com/migration-guide#optional-is-no-longer-inherited-by-a-redeclared-constructor).

Compile with Nest-compatible legacy decorators and preserve metadata for implicit class injection; `OrderStore` is an erased interface, so the example always uses an explicit token. Check Node and module loading separately: the [Nest compatibility table](https://docs.nestjs.com/faq/versions) gives Node floors of 16 for Nest 10 and 20 for Nest 11; the [Nest 12 ESM migration](https://docs.nestjs.com/migration-guide#nodejs-requirements) documents Node 20.19+ on 20.x and 22.12+ on 22.x for CommonJS interop, with 21.x unsupported. Do not treat the CLI or test-runner floor as the application floor.

## Verification

1. Compile a test module importing the consuming module with only the database boundary substituted; resolve its consumer and execute an exported operation.
2. Remove the owning module's export temporarily in the test scenario; compilation should fail rather than being rescued by a mock or global registration.
3. Trace imports in both directions. If request scope is used, interleave two requests with different principals and verify they cannot share request data.
4. If an optional subclass dependency is involved, run the same module check on each supported major: missing `OPTIONS` resolves to `undefined`, and registration injects the exact supplied value. Boot from the project's compiled output on its minimum supported Node runtime to check module loading.
