# FastAPI background callback failures

**Read when:** One response schedules multiple disposable callbacks or a failed callback silently prevents later cleanup.

## Decision

Starlette runs accumulated background tasks in order; if a task raises, later tasks aren't run. Keep truly independent best-effort actions independent on their expected failure path. Handle and count anticipated failures inside the callback; unexpected exceptions must still reach server diagnostics. A background failure can't rewrite a response already sent.

## Bad

```python
@router.post("/devices/{device_id}/refresh")
def refresh(device_id: str, tasks: BackgroundTasks):
    version = devices.refresh(device_id)
    tasks.add_task(metrics.emit_refresh, device_id)
    tasks.add_task(cache.evict_versioned, device_id, version)
    return {"version": version}
```

A metrics timeout skips cache eviction, although eviction doesn't require a successful metrics call.

## Good

```python
from fastapi import BackgroundTasks


def evict_then_measure(device_id: str, version: int):
    try:
        cache.evict_versioned(device_id, version)
    except CacheUnavailable:
        logger.warning("refresh_cache_evict_failed")
    try:
        metrics.emit_refresh(device_id)
    except MetricsUnavailable:
        logger.warning("refresh_metric_emit_failed")


@router.post("/devices/{device_id}/refresh")
def refresh(device_id: str, tasks: BackgroundTasks):
    version = devices.refresh(device_id)
    tasks.add_task(evict_then_measure, device_id, version)
    return {"version": version}
```

## Assumptions and exceptions

The route already enforces write access and `devices.refresh` commits before returning. Callbacks use application-owned clients with timeouts, not a request-scoped session. The cache has bounded staleness without eviction and the eviction is safe if refreshes finish out of order. If an action must survive crashes or even arbitrary callback errors, give it durable, independently retryable delivery instead.

## Verification

Run the route with fake callbacks and capture logs. Force the first to raise `CacheUnavailable`; assert the committed version is returned, the warning is recorded once, and metrics still executes. Force an unexpected exception and assert it reaches the configured server error sink; for response ordering, observe a blocked callback through a live local ASGI connection rather than relying on `TestClient` completion time.
