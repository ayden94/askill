# Transaction and retry ownership

**Invariant:** Order, inventory, request idempotency and outbox changes commit together or not at all. Retrying with the original key produces one logical order even after a lost acknowledgment.

**Compatibility:** `unitOfWork` and `retryKnownRollback` are application ports, not Nest decorators. The example is independent of the Nest major and the HTTP adapter; it requires a datastore that can execute every participating write atomically. An ORM-backed implementation must use the callback's transaction handle, not the globally injected repository.

**Assumptions:** Inventory, orders, idempotency records and the outbox share a transactional datastore. The application has a transaction port whose callback receives bound repositories. `idempotency.run` enforces an atomic unique key per actor/operation and rejects reuse with a different normalized command; it records the result in the same transaction.

Own the transaction in the use case, not in a controller or individual repository writes. All participating repositories use the same transaction handle. Write the outbox entry with the change; a worker publishes committed entries and deduplicates delivery with a stable event ID and an idempotent receiver. Do not retry a partially committed workflow as if it were one operation.

## Bad

```ts
const order = await orders.create(command);
await notifications.sendOrderConfirmed(order.id);
await inventory.reserve(command.sku, command.quantity);
return order;
```

## Good

```ts
return retryKnownRollback(() => unitOfWork.transaction(async tx => {
  await assertCanOrder(tx, actor, command);
  return tx.idempotency.run(
    { actorId: actor.id, operation: 'place-order', key, fingerprint: hash(command) },
    async () => {
      await tx.inventory.reserveOrThrow(command.sku, command.quantity);
      const order = await tx.orders.create(actor.id, command);
      await tx.outbox.add({ id: `order-confirmed:${order.id}`, orderId: order.id });
      return { id: order.id };
    },
  );
}));
```

`reserveOrThrow` must enforce its invariant under concurrent transactions, not by checking an unlocked stale stock read. Retry only classified transient failures known to have rolled back, with bounded backoff and jitter, recreating the transaction each time. Propagate business rejections without retry. After an ambiguous commit, recover by querying or resubmitting with the original key; never generate a fresh key for that attempt. Define duplicate outcome, retention, deadline and exhausted-retry response in the API contract.

If the project uses TypeORM, **0.2.x** starts with `connection.transaction(manager => run(bindRepositories(manager)))`; **0.3.x** uses `dataSource.transaction(manager => run(bindRepositories(manager)))`. `bindRepositories` obtains every repository from that `manager`. [`Connection` became deprecated in 0.3.0](https://github.com/typeorm/typeorm/blob/0.3.0/CHANGELOG.md#030-2022-03-17) in favor of `DataSource`; the [transaction callback contract](https://typeorm.io/docs/transactions/) is unchanged in substance. For PostgreSQL, for instance, SQLSTATE `40001` is a serialization failure: retry the entire transaction, not just the failing statement. Do not classify an unknown commit outcome as a rollback. See [PostgreSQL's retry guidance](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html).

**Exception:** One atomic statement may already guarantee the entire invariant. If stores cannot share a transaction, use the project's durable saga or equivalent recovery design with explicit intermediate states and compensation; do not promise cross-store rollback.

## Verification

1. Against the real database engine on either ORM setup, fail reservation and fail a later outbox write. Verify no order, reservation, idempotency record, or outbox event from either attempt survives.
2. Race matching requests with the same key and assert one logical order and outbox entry; change the payload under that key and assert conflict. Race different keys against limited stock and check the invariant.
3. Test known rollback retry, retry exhaustion and lost success response. Re-run delivery after a worker failure and verify the consumer sees one logical effect.
