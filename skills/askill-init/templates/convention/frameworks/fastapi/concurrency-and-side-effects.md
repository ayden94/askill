# FastAPI concurrency and side effects

## Context

Use this for blocking SDKs, outbound I/O, retries, and tasks that run beyond the response. `async def` is not an offload instruction: synchronous helpers called inside it still run on the event-loop thread.

## Rules

- Pair `async def` with awaitable I/O. If the entire endpoint uses a blocking client, a regular `def` handler lets FastAPI run it in the worker thread pool; if only one operation blocks, offload that operation explicitly and budget thread use.
- Set deadlines at the actual I/O layer. Offloading a blocking function does not make the underlying call cancellable. Avoid per-request creation of reusable connection pools.
- Use in-process `BackgroundTasks` only for work you can lose after responding. For guaranteed acceptance, persist a job/outbox entry before returning `202`; make the worker retry-safe.
- Give replayable writes a deliberate idempotency key and uniqueness rule. A client timeout or disconnect does not prove an already committed write never happened.

## Wrong: blocking the loop and claiming durable acceptance

```python
@router.post("/exports", status_code=202)
async def export(body: ExportRequest, tasks: BackgroundTasks):
    report = legacy_sdk.read_report(body.report_id)
    tasks.add_task(store_export, report)
    return {"status": "accepted"}
```

The SDK call monopolizes the loop while waiting, and a worker restart can lose the export after `202`.

## Right: accept a durable intent and do blocking work in the worker

```python
from typing import Annotated
from fastapi import Header

@router.post("/exports", status_code=202)
def export(
    body: ExportRequest,
    key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=128)],
    actor: CurrentActor,
):
    job = export_jobs.enqueue_committed(
        owner_id=actor.id, key=key, report_id=body.report_id,
    )
    return {"job_id": str(job.id)}

def process_export(job):
    report = legacy_sdk.read_report(job.report_id, timeout=5)
    store_export_once(job.id, report)
```

The synchronous repository runs off the event loop. `enqueue_committed` checks access, persists under a unique `(owner_id, key)`, and refuses same-key/different-payload reuse. The worker acknowledges only after storing output. Durable jobs add schema, retry, and operations overhead; don't require that machinery for disposable telemetry.

## Exceptions

CPU-bound work belongs in a separate process or worker when threads don't provide the required isolation. Tiny, predictable computations can stay inline; don't move every helper to a thread. In-memory ASGI tests can wait for background tasks, so don't use their return time to infer client-observed ordering.

## Verification

1. Hold the blocking dependency with a bounded test event while exercising an independent async endpoint through the running server. Pass if the independent request can finish before release within its deadline.
2. Block worker consumption and submit an export twice with the same identity and key. Pass if both responses identify the same persisted job; the same key with changed payload fails according to the conflict contract.
3. Restart or replay the worker after a simulated failure. Pass if the accepted job remains visible and retry produces one output even when completion is observed more than once.

Reference: [FastAPI async and sync handlers](https://fastapi.tiangolo.com/async/) and [background tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/).
