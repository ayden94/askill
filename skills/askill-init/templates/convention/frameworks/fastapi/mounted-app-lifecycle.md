# FastAPI mounted app lifecycle

**Read when:** Mounting a second FastAPI application, especially one with resource dependencies.

## Decision

Don't assume the server drives lifespan for mounted children. If parent and child deploy together, have the root lifespan acquire and close the resources; explicitly expose them on the app whose handlers read them. Use `include_router()` instead of mounting if separate ASGI apps aren't needed.

## Bad

```python
reports = FastAPI(lifespan=reports_lifespan)
root = FastAPI()
root.mount("/reports", reports)

@reports.get("/summary")
async def summary(request: Request):
    return await request.app.state.reader.summary()
```

The route is mounted, but `reports_lifespan` hasn't run just because `root` started.

## Good

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request


def create_app(open_reader):
    reports = FastAPI()

    @reports.get("/summary")
    async def summary(request: Request):
        return await request.app.state.reader.summary()

    @asynccontextmanager
    async def lifespan(_root):
        async with open_reader() as reader:
            reports.state.reader = reader
            try:
                yield
            finally:
                del reports.state.reader

    root = FastAPI(lifespan=lifespan)
    root.mount("/reports", reports)
    return root
```

## Assumptions and exceptions

`open_reader()` provides an async context manager; the reader supports concurrent requests. Each root and child pair belongs to one factory invocation. A separately deployed child that also runs standalone needs its own explicit composition path; don't enter the same resource twice.

## Verification

Use a counted fake reader and enter `TestClient(create_app(open_reader))`. Request `/reports/summary` twice and assert both calls use the same reader. Close the client and assert one close. Repeat with a second root and confirm it gets a distinct reader; force acquisition to fail and assert startup fails before the route can serve traffic.
