# FastAPI streaming response ownership

**Read when:** A response becomes incremental and reads from a cursor or other closeable producer.

## Decision

Perform access checks and other failures that need an HTTP status before returning `StreamingResponse`. Acquire resources during iteration, not in the handler's exiting `async with` block. If a stable result can be read in batches, release the connection before yielding bytes so socket backpressure can't hold a pool slot. After response headers are sent you can't replace a broken stream with a JSON error.

## Bad

```python
@router.get("/reports/{report_id}/rows")
async def rows(report_id: str):
    async with reports.open_cursor(report_id) as cursor:
        return StreamingResponse(cursor.lines(), media_type="application/x-ndjson")
```

The cursor closes when the handler returns, before the body is consumed.

## Good

```python
from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.responses import StreamingResponse


@router.get("/reports/{report_id}/rows")
async def rows(report_id: str, actor: Annotated[Actor, Depends(require_actor)]):
    if not await reports.can_stream(report_id, actor.tenant_id):
        raise HTTPException(404)
    tenant_id = actor.tenant_id

    async def generate():
        after_id = None
        while True:
            async with reports.open_reader() as reader:
                batch = await reader.encoded_rows(
                    report_id, tenant_id, after_id=after_id, limit=100,
                )
            if not batch:
                break
            for row_id, line in batch:
                yield line
                after_id = row_id

    return StreamingResponse(generate(), media_type="application/x-ndjson")
```

## Assumptions and exceptions

The report is finalized and immutable. `encoded_rows()` returns an eagerly materialized, bounded batch of `(id, complete NDJSON record bytes)`, scoped to tenant and ordered by unique ascending ID, strictly after `after_id`. The reader closes with bounded, cancellation-safe cleanup if a fetch is interrupted. If you need one consistent read of mutable data, this batched design isn't a snapshot: consider materializing an artifact, or explicitly manage cursor lifetime and test both disconnect during a fetch and failure during a socket send.

## Verification

Through a live local ASGI connection, block the second batch read and assert the client receives the first batch before release. Test all IDs arrive once on a full read. Disconnect during a batch fetch and verify the reader releases the pool slot within a deadline. Try a foreign ID (no reader, `404`) and an injected midstream fault (documented truncation and one internal diagnostic, not a second HTTP response).
