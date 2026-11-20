# FastAPI dependencies and lifespan

**Invariant:** Every resource is acquired once per intended owner and closed on success or failure, never before its last consumer.

**Scope:** Version-sensitive for application lifespan wiring and `yield` dependency teardown. Applies to ASGI app instances and request dependencies, not deployment-wide jobs.

## Context

Use this when introducing a shared HTTP client, database/session dependency, or access check. App resources and request resources have different owners; mixing them can leave a resource bound to a dead event loop or reused across concurrent requests.

## Rules

- Construct loop-bound pools/clients in the app lifespan; release them on exit even on failure. Lifespan runs per app instance in each worker, not once across the deployment.
- Use request dependencies to bind identity and acquire request-scoped resources. For `yield` dependencies, ensure cleanup on both success and failure; don't swallow endpoint exceptions or hide a database commit in teardown.
- Keep commit/rollback in the use case so successful response construction follows a successful commit. Never pass a request-owned session into a background task; give it identifiers and acquire its own resources.
- For streams, don't assume the dependency is still alive during body iteration. Check the installed version's `yield` teardown behavior and explicit scope options, or own the resource within the iterator.

## Wrong: an unmanaged global device client

```python
client = httpx.AsyncClient()

@app.get("/readings/{device_id}")
async def reading(device_id: str):
    return (await client.get(f"{UPSTREAM}/readings/{device_id}")).json()
```

Nothing closes the client. Import-time configuration complicates test isolation, and the route forwards unvalidated upstream data.

## Right: lifespan owns the pool, the dependency exposes it

```python
from contextlib import asynccontextmanager
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, Request

def create_app(upstream_url: str) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async with httpx.AsyncClient(base_url=upstream_url, timeout=3.0) as client:
            app.state.readings = ReadingsGateway(client)
            yield

    app = FastAPI(lifespan=lifespan)

    def get_readings(request: Request) -> ReadingsGateway:
        return request.app.state.readings

    @app.get("/readings/{device_id}")
    async def reading(device_id: str, gateway: Annotated[ReadingsGateway, Depends(get_readings)]):
        return await gateway.read_public(device_id)

    return app
```

`ReadingsGateway` owns upstream status/schema translation; it borrows, rather than closes, the lifespan client. Share connection pools, not mutable request state. For tests that override a route dependency, expose the callable from a stable module rather than recreating it as a local closure, or inject a gateway factory into `create_app`.

## Version choice: app lifespan

- **FastAPI >=0.93.0:** Use `FastAPI(lifespan=lifespan)` as above. [0.93.0 introduced the lifespan context manager](https://fastapi.tiangolo.com/release-notes/#0930-2023-03-07). On releases below [0.95.0](https://fastapi.tiangolo.com/release-notes/#0950-2023-03-18), declare `gateway: ReadingsGateway = Depends(get_readings)` rather than using `Annotated` for the dependency.
- **FastAPI <0.93.0, if maintained:** Keep the same `lifespan` context manager but enter and exit it from the [startup and shutdown events](https://fastapi.tiangolo.com/advanced/events/#alternative-events-deprecated). Replace the app construction above with:

  ```python
  app = FastAPI()

  @app.on_event("startup")
  async def startup():
      context = lifespan(app)
      await context.__aenter__()
      app.state.readings_context = context

  @app.on_event("shutdown")
  async def shutdown():
      await app.state.readings_context.__aexit__(None, None, None)
  ```

  Declare `gateway: ReadingsGateway = Depends(get_readings)` on the route here too.

## Version choice: `yield` dependencies on streaming routes

Use the [documented teardown timeline](https://fastapi.tiangolo.com/advanced/advanced-dependencies/#dependencies-with-yield-and-streamingresponse-technical-details) to choose who owns the streaming resource:

| FastAPI | Recipe |
| --- | --- |
| Before `0.106.0` (if maintained and already using `yield`) | Default cleanup happens late; use [iterator-owned resources](streaming-responses.md) rather than taking a dependency on legacy ordering. |
| `>=0.106.0, <0.118.0` | Cleanup happens before the response is sent. Use the dependency only for preflight and have the iterator acquire/close its reader. |
| `>=0.118.0, <0.121.0` | Default cleanup is after sending the response; `Depends(open_reader)` can lend the reader through body iteration, or use iterator ownership to limit connection occupancy. |
| `>=0.121.0` | Use `Depends(open_reader, scope="request")` if the stream consumes the dependency; use `scope="function"` for preflight-only resources that should close before sending. See [dependency scopes](https://fastapi.tiangolo.com/advanced/advanced-dependencies/#dependencies-with-yield-and-scope). |

If a `yield` dependency catches an endpoint exception to clean up, explicitly `raise` it again in all these ranges. FastAPI [stopped automatically forwarding swallowed exceptions in 0.110.0](https://fastapi.tiangolo.com/advanced/advanced-dependencies/#dependencies-with-yield-and-except-technical-details); use `finally` if cleanup doesn't need to inspect the exception.

## Exceptions

Immutable configuration can be import-time data if failure and test isolation are explicit. Migrate legacy startup/shutdown handlers together when switching an app to `lifespan`; don't assume both registration styles run together. Use `AsyncExitStack` when multiple startup acquisitions need partial-failure cleanup.

## Verification

1. Enter a `TestClient` context with a fake gateway/client and instrument acquisition and close. Send two requests; then exit.
2. Exercise a failed request with a request-scoped resource. For multi-resource startup, force a later acquisition to fail.
3. Pass if the same app client is reused within one lifespan, tests see no state from previous app instances, closes occur exactly once, and request cleanup and partial startup cleanup still occur on failure.
4. For either streaming resource strategy, block mid-body over a live ASGI connection, assert reads never use a closed reader, then finish or disconnect and assert reader release within a deadline.

Reference: [FastAPI lifespan events](https://fastapi.tiangolo.com/advanced/events/) and [dependencies with yield](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/).
