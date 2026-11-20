# Modules and dependency injection

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

## Verification

1. Compile a test module importing the consuming module with only the database boundary substituted; resolve its consumer and execute an exported operation.
2. Remove the owning module's export temporarily in the test scenario; compilation should fail rather than being rescued by a mock or global registration.
3. Trace imports in both directions. If request scope is used, interleave two requests with different principals and verify they cannot share request data.
