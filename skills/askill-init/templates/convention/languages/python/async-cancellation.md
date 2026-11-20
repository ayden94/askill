# Cancel and join sibling coroutines within their scope

## When to read

Read when concurrent `asyncio` operations form one unit and the caller must not finish while a failed operation's sibling keeps running.

## Decision

Use an owned task group for fail-together work. Default `asyncio.gather` propagates the first ordinary exception but does not cancel the other awaitables. Put cleanup in each operation's `finally` block and do not swallow cancellation.

## Bad

```python
import asyncio

async def load_dashboard(load_orders, load_totals):
    return await asyncio.gather(load_orders(), load_totals())
```

## Good

```python
import asyncio

async def load_dashboard(load_orders, load_totals):
    async with asyncio.TaskGroup() as group:
        orders = group.create_task(load_orders())
        totals = group.create_task(load_totals())
    return orders.result(), totals.result()
```

## Assumptions and trade-offs

Python 3.11+ and loaders that cooperate with cancellation are required. An ordinary child failure cancels remaining children; exit waits for them and raises an exception group rather than exposing a partial tuple. Cancellation is not rollback for completed writes, and a coroutine that blocks the loop cannot stop promptly. Use independent outcome handling instead if partial success is part of the contract.

## Verification

Have the totals loader signal entry, then wait with cleanup in `finally`. Have the orders loader wait for that signal and raise `ValueError`. Repeat with external cancellation of the dashboard while both children wait. **Pass:** the first caller receives a group containing `ValueError` only after sibling cleanup, and the canceled caller gets `CancelledError` after its children's cleanup.
