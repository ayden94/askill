# Cancel and join sibling coroutines within their scope

**Invariant:** On an ordinary loader failure or caller cancellation, the dashboard does not exit until all owned loaders have finished cleanup; success returns both results in input order.

**Compatibility:** Version-dependent implementation for Python 3.9+. Python 3.11 added `asyncio.TaskGroup` and exception groups ([Python 3.11 release notes](https://docs.python.org/3.11/whatsnew/3.11.html#asyncio)); Python 3.9–3.10 need explicit task ownership and joining.

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

Python **3.11+**:

```python
# Python >= 3.11
import asyncio

async def load_dashboard(load_orders, load_totals):
    async with asyncio.TaskGroup() as group:
        orders = group.create_task(load_orders())
        totals = group.create_task(load_totals())
    return orders.result(), totals.result()
```

Python **3.9–3.10**:

```python
# Python >= 3.9, < 3.11
import asyncio

async def load_dashboard(load_orders, load_totals):
    tasks = [
        asyncio.create_task(load_orders()),
        asyncio.create_task(load_totals()),
    ]
    try:
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
        for task in tasks:
            if task in done and not task.cancelled():
                error = task.exception()
                if error is not None:
                    raise error
        return tuple(task.result() for task in tasks)
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        joined = asyncio.gather(*tasks, return_exceptions=True)
        interrupted = False
        while not joined.done():
            try:
                await asyncio.shield(joined)
            except asyncio.CancelledError:
                # Keep a second cancellation from interrupting loader cleanup.
                interrupted = True
        if interrupted:
            raise asyncio.CancelledError
```

## Assumptions and trade-offs

Loaders are async functions that cooperate with cancellation. `TaskGroup` cancels siblings for non-cancellation failures and waits for them; it aggregates ordinary errors into an `ExceptionGroup`, whereas the legacy recipe surfaces one ordinary failure and drains other outcomes. Neither treats a child merely ending in `CancelledError` as a fail-fast sibling error. Don't catch and swallow `CancelledError`; run cleanup in `finally`. The shared contract does not specify precedence when caller cancellation races with child failure: Python 3.13 improved `TaskGroup`'s handling of simultaneous internal/external cancellation ([Python 3.13 release notes](https://docs.python.org/3.13/whatsnew/3.13.html#asyncio)). Cancellation is not rollback for completed writes, and a coroutine that blocks the loop cannot stop promptly.

## Verification

Run the same three cases with either implementation. First, return two distinct values and assert their order is `(orders, totals)`. Next, have totals signal entry then wait with cleanup in `finally`; have orders wait for entry and raise `ValueError`. Finally, wait for both children to signal entry, then cancel the dashboard while both wait. Bound the test waits. **Pass:** the failure contains `ValueError` (directly on 3.9–3.10, in a group on 3.11+) and the canceled call raises `CancelledError`; in both cases the relevant cleanup signals are already set at caller exit.
