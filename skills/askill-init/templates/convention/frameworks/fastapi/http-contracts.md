# FastAPI HTTP contracts

## Context

Use this when adding or changing an endpoint. FastAPI validates declared request inputs; a Python annotation on a helper doesn't validate external data, grant permission, or make an internal record safe to return.

## Rules

- Model request and response separately. Select known writable fields and explicitly decide how unknown keys, coercion, omitted values, and explicit nulls behave. For a partial update, preserve the distinction between missing and `null` (for Pydantic v2, consider `model_dump(exclude_unset=True)`).
- Use validated inputs to call the use case, not to decide access from client-provided ownership fields. Derive identity from a trusted dependency and scope reads/writes in the use case.
- Return a public response model or explicit projection. Returning a constructed `Response`/`JSONResponse` directly bypasses automatic response-model filtering and validation; manually serialize a validated public projection when using this escape hatch.
- Keep malformed input, unauthenticated/forbidden calls, conflicts, and server defects distinct. Request validation normally gives `422`; a response-schema mismatch is a server defect, not input feedback.

## Wrong: a raw dictionary in and a raw record out

```python
@router.post("/devices")
def create_device(body: dict):
    device = devices.create(body)
    return JSONResponse(content=device)
```

Unknown fields reach persistence; `device` may include a provisioning secret. Adding a response type annotation alone won't filter this direct response.

## Right: explicit write and read contracts

```python
from typing import Annotated

from fastapi import Depends
from pydantic import BaseModel, ConfigDict, Field

class DeviceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str = Field(min_length=1, max_length=80)
    sample_rate: int = Field(strict=True, ge=1, le=60)

class DeviceRead(BaseModel):
    id: str
    label: str

@router.post("/devices", response_model=DeviceRead, status_code=201)
def create_device(
    body: DeviceCreate,
    actor: Annotated[Actor, Depends(current_actor)],
    devices: Annotated[DeviceStore, Depends(get_device_store)],
):
    device = devices.create_for(actor, label=body.label, rate=body.sample_rate)
    return DeviceRead(id=str(device.id), label=device.label)
```

Rejecting unknown fields catches typos and unapproved writes, but reduces forward-compatible tolerance. Strict rate validation here targets a JSON number; query strings arrive as text and require a different parsing contract.

## Exceptions

Streaming, redirects, and binary responses may need direct response classes. Document content type and status, test the actual payload, and don't depend on response-model filtering. A compatibility-sensitive API may allow extra keys but still project only permitted writes.

## Verification

1. Send a valid JSON body, then cases for missing/null fields, an unknown key, a string rate, and rates `0`, `1`, `60`, and `61`.
2. With a valid body, send absent credentials and credentials without create permission in separate requests. Use a storage record containing a fake secret in the success case.
3. Pass if malformed calls return the documented validation fields without writes, unauthorized calls cannot create records, boundaries behave as documented, and `201` exposes exactly the public response fields.

Reference: [FastAPI response models](https://fastapi.tiangolo.com/tutorial/response-model/), [returning a response directly](https://fastapi.tiangolo.com/advanced/response-directly/), and [Pydantic strict mode](https://docs.pydantic.dev/latest/concepts/strict_mode/).
