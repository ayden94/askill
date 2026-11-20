# Django transactions and queries

**Invariant:** Competing writers preserve the stored invariant, rolled-back work emits no commit callback, and related reads stay within a bounded query budget.

**Scope:** Portable transaction and query patterns on Django 4.2 and newer. Verify locks on the deployed database; the example uses the default alias and does not opt into robust callback handling.

## Context

Use this when a use case mutates several rows, coordinates competing writers, or renders a list with related data. QuerySets are lazy: building a queryset doesn't execute it, even inside a transaction.

## Rules

- Put the smallest useful `transaction.atomic()` around the database invariant. Evaluate `select_for_update()` within that block on a backend that supports the lock; read and modify the same locked row. Acquire multiple locks in a stable order.
- Catch database errors outside the affected atomic block or outside an inner savepoint. Don't keep querying in a broken transaction. Reload or discard mutated Python objects after rollback.
- Register non-durable follow-up work via `on_commit()` on the same database alias. It is after-commit, not guaranteed delivery; record an outbox row in the transaction for durable delivery.
- Use `select_related` for accessed foreign key/one-to-one objects and `prefetch_related` for collections. Measure a populated, rendered page and avoid replacing a prefetched relation with a new filtered query per row.

## Wrong: an unlocked read and premature side effect

```python
def reserve(item_id):
    item = Stock.objects.get(pk=item_id)
    if item.available < 1:
        raise SoldOut()
    item.available -= 1
    item.save(update_fields=["available"])
    announce_reservation(item_id)
    return Reservation.objects.create(stock=item)
```

Concurrent requests can both reserve the last item. If reservation creation fails, the decrement and notification may already have happened.

## Right: serialize writers and defer notification

```python
from functools import partial
from django.db import transaction

def reserve(item_id):
    with transaction.atomic():
        item = Stock.objects.select_for_update().get(pk=item_id)
        if item.available < 1:
            raise SoldOut()
        item.available -= 1
        item.save(update_fields=["available"])
        reservation = Reservation.objects.create(stock=item)
        transaction.on_commit(partial(announce_reservation, reservation.pk))
    return reservation
```

The lock holds until the outer transaction exits. Keep slow I/O out of that block. An `on_commit` failure doesn't undo a successful write; make downstream handling safe to retry if needed. This example assumes the default database.

## Exceptions

For a single counter, an atomic conditional `UPDATE` using `F()` and checking the affected row count can replace a read lock. For SQLite, do not infer production row-lock semantics from a passing test. Prefetch only what the bounded page consumes; unbounded prefetch trades query count for memory.

## Verification

1. On the deployed database type in `TransactionTestCase`, seed one unit, then issue two reservations with separate connections and a bounded synchronization barrier. Pass if one succeeds, one reports sold out, and persisted counts are exactly zero stock and one reservation.
2. Force the second write to fail and reload from the database. Pass if stock is unchanged and no callback fires; on genuine commit assert exactly one notification.
3. For any changed list, request/render it with one and with many rows containing related data. Pass if query count stays within the agreed budget rather than growing per row.

Reference: [Django 5.2 transactions](https://docs.djangoproject.com/en/5.2/topics/db/transactions/) and [QuerySet API](https://docs.djangoproject.com/en/5.2/ref/models/querysets/).
