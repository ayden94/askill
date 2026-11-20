# Transaction and retry ownership

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

**Exception:** One atomic statement may already guarantee the entire invariant. If stores cannot share a transaction, use the project's durable saga or equivalent recovery design with explicit intermediate states and compensation; do not promise cross-store rollback.

## Verification

1. Against the real database engine, fail reservation and fail a later outbox write. Verify no order, reservation, or event from either failed operation survives.
2. Race matching requests with the same key and assert one logical order and outbox entry; change the payload under that key and assert conflict. Race different keys against limited stock and check the invariant.
3. Test known rollback retry, retry exhaustion and lost success response. Re-run delivery after a worker failure and verify the consumer sees one logical effect.
